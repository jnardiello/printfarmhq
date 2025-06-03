"""
Advanced metrics queries for God Admin dashboard.
Tracks user behavior, engagement, and business metrics.
"""
from sqlalchemy import func, case, and_, or_, distinct
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, date
from typing import List, Dict, Any

from . import models

def get_active_user_metrics(db: Session, days: int = 30) -> List[Dict[str, Any]]:
    """
    Calculate Daily Active Users (DAU), Weekly Active Users (WAU), and Monthly Active Users (MAU).
    An active user is one who has performed any action (login, create, update) on that day.
    """
    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=days-1)
    
    metrics = []
    
    for i in range(days):
        current_date = start_date + timedelta(days=i)
        
        # DAU: Users active on this specific day
        dau = db.query(func.count(distinct(models.User.id))).filter(
            or_(
                # Users who logged in (would need login tracking)
                func.date(models.User.last_login) == current_date,
                # Users who created products
                models.User.id.in_(
                    db.query(models.Product.owner_id).filter(
                        func.date(models.Product.created_at) == current_date
                    )
                ),
                # Users who created print jobs
                models.User.id.in_(
                    db.query(models.PrintJob.owner_id).filter(
                        func.date(models.PrintJob.created_at) == current_date
                    )
                ),
                # Users who made filament purchases
                models.User.id.in_(
                    db.query(models.FilamentPurchase.owner_id).filter(
                        func.date(models.FilamentPurchase.purchase_date) == current_date
                    )
                )
            )
        ).scalar() or 0
        
        # WAU: Users active in the past 7 days
        wau_start = current_date - timedelta(days=6)
        wau = db.query(func.count(distinct(models.User.id))).filter(
            or_(
                and_(
                    func.date(models.User.last_login) >= wau_start,
                    func.date(models.User.last_login) <= current_date
                ),
                models.User.id.in_(
                    db.query(models.Product.owner_id).filter(
                        func.date(models.Product.created_at) >= wau_start,
                        func.date(models.Product.created_at) <= current_date
                    )
                ),
                models.User.id.in_(
                    db.query(models.PrintJob.owner_id).filter(
                        func.date(models.PrintJob.created_at) >= wau_start,
                        func.date(models.PrintJob.created_at) <= current_date
                    )
                )
            )
        ).scalar() or 0
        
        # MAU: Users active in the past 30 days
        mau_start = current_date - timedelta(days=29)
        mau = db.query(func.count(distinct(models.User.id))).filter(
            or_(
                and_(
                    func.date(models.User.last_login) >= mau_start,
                    func.date(models.User.last_login) <= current_date
                ),
                models.User.id.in_(
                    db.query(models.Product.owner_id).filter(
                        func.date(models.Product.created_at) >= mau_start,
                        func.date(models.Product.created_at) <= current_date
                    )
                ),
                models.User.id.in_(
                    db.query(models.PrintJob.owner_id).filter(
                        func.date(models.PrintJob.created_at) >= mau_start,
                        func.date(models.PrintJob.created_at) <= current_date
                    )
                )
            )
        ).scalar() or 0
        
        # New vs Returning users for this day
        new_users = db.query(func.count(models.User.id)).filter(
            func.date(models.User.created_at) == current_date
        ).scalar() or 0
        
        returning_users = max(0, dau - new_users)
        
        metrics.append({
            "date": current_date,
            "daily_active_users": dau,
            "weekly_active_users": wau,
            "monthly_active_users": mau,
            "new_vs_returning": {
                "new": new_users,
                "returning": returning_users
            }
        })
    
    return metrics


def get_business_metrics(db: Session, days: int = 30) -> List[Dict[str, Any]]:
    """
    Track business-critical metrics like filament consumption, print success rates, etc.
    """
    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=days-1)
    
    metrics = []
    
    for i in range(days):
        current_date = start_date + timedelta(days=i)
        
        # Total filament consumed (from print jobs)
        filament_consumed = db.query(
            func.coalesce(func.sum(models.PrintJob.actual_filament_used_g), 0)
        ).filter(
            func.date(models.PrintJob.created_at) == current_date,
            models.PrintJob.status == 'completed'
        ).scalar() or 0.0
        
        # Average print time
        avg_print_time = db.query(
            func.avg(models.PrintJob.actual_print_time_hrs)
        ).filter(
            func.date(models.PrintJob.created_at) == current_date,
            models.PrintJob.status == 'completed'
        ).scalar() or 0.0
        
        # Print success rate
        total_jobs = db.query(func.count(models.PrintJob.id)).filter(
            func.date(models.PrintJob.created_at) == current_date
        ).scalar() or 0
        
        successful_jobs = db.query(func.count(models.PrintJob.id)).filter(
            func.date(models.PrintJob.created_at) == current_date,
            models.PrintJob.status == 'completed'
        ).scalar() or 0
        
        success_rate = (successful_jobs / total_jobs * 100) if total_jobs > 0 else 0
        
        # Top products printed today
        top_products = db.query(
            models.Product.name,
            func.count(models.PrintJob.id).label('count')
        ).join(
            models.PrintJob, models.Product.id == models.PrintJob.product_id
        ).filter(
            func.date(models.PrintJob.created_at) == current_date
        ).group_by(
            models.Product.name
        ).order_by(
            func.count(models.PrintJob.id).desc()
        ).limit(5).all()
        
        # Top filaments used today
        top_filaments = db.query(
            models.Filament.brand,
            models.Filament.material,
            models.Filament.color,
            func.sum(models.PrintJob.actual_filament_used_g).label('usage_g')
        ).join(
            models.PrintJob, models.Filament.id == models.PrintJob.filament_id
        ).filter(
            func.date(models.PrintJob.created_at) == current_date,
            models.PrintJob.status == 'completed'
        ).group_by(
            models.Filament.id,
            models.Filament.brand,
            models.Filament.material,
            models.Filament.color
        ).order_by(
            func.sum(models.PrintJob.actual_filament_used_g).desc()
        ).limit(5).all()
        
        metrics.append({
            "date": current_date,
            "total_filament_consumed_g": float(filament_consumed),
            "avg_print_time_hrs": float(avg_print_time),
            "print_success_rate": float(success_rate),
            "top_products": [
                {"name": p.name, "count": p.count} for p in top_products
            ],
            "top_filaments": [
                {
                    "name": f"{f.brand} {f.material} - {f.color}",
                    "usage_g": float(f.usage_g)
                } for f in top_filaments
            ]
        })
    
    return metrics


def get_user_retention_cohorts(db: Session, lookback_days: int = 90) -> List[Dict[str, Any]]:
    """
    Calculate user retention by cohort (users who signed up on the same day).
    """
    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=lookback_days)
    
    cohorts = []
    
    # Get daily cohorts
    cohort_dates = db.query(
        func.date(models.User.created_at).label('cohort_date'),
        func.count(models.User.id).label('cohort_size')
    ).filter(
        func.date(models.User.created_at) >= start_date,
        func.date(models.User.created_at) <= end_date
    ).group_by(
        func.date(models.User.created_at)
    ).all()
    
    for cohort in cohort_dates:
        cohort_date = datetime.strptime(str(cohort.cohort_date), '%Y-%m-%d').date()
        cohort_users = db.query(models.User.id).filter(
            func.date(models.User.created_at) == cohort_date
        ).all()
        cohort_user_ids = [u.id for u in cohort_users]
        
        if not cohort_user_ids:
            continue
            
        # Calculate retention rates
        retention_1d = calculate_retention_rate(db, cohort_user_ids, cohort_date, 1)
        retention_7d = calculate_retention_rate(db, cohort_user_ids, cohort_date, 7)
        retention_30d = calculate_retention_rate(db, cohort_user_ids, cohort_date, 30)
        
        cohorts.append({
            "cohort_date": cohort_date,
            "cohort_size": cohort.cohort_size,
            "retention_1_day": retention_1d,
            "retention_7_day": retention_7d,
            "retention_30_day": retention_30d
        })
    
    return cohorts


def calculate_retention_rate(db: Session, user_ids: List[int], cohort_date: date, days_later: int) -> float:
    """Calculate what percentage of users were active N days after signup."""
    target_date = cohort_date + timedelta(days=days_later)
    
    if target_date > datetime.utcnow().date():
        return None  # Can't calculate future retention
    
    active_users = db.query(func.count(distinct(models.User.id))).filter(
        models.User.id.in_(user_ids),
        or_(
            func.date(models.User.last_login) == target_date,
            models.User.id.in_(
                db.query(models.Product.owner_id).filter(
                    func.date(models.Product.created_at) == target_date
                )
            ),
            models.User.id.in_(
                db.query(models.PrintJob.owner_id).filter(
                    func.date(models.PrintJob.created_at) == target_date
                )
            )
        )
    ).scalar() or 0
    
    return (active_users / len(user_ids) * 100) if user_ids else 0