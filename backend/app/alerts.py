"""
Alert generation system for PrintFarmHQ
Generates inventory, business, and security alerts for users
"""

import os
import uuid
from typing import List, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from . import models

# Alert configuration thresholds
ALERT_THRESHOLDS = {
    "filament_low_stock_kg": 0.3,  # Alert when < 300g
    "filament_critical_stock_kg": 0.1,  # Critical when < 100g
    "filament_out_of_stock_kg": 0.0,  # Out of stock
    "subscription_expiry_days": 30,  # Alert 30 days before expiry
    "default_password": "changeme123",  # Default password to check against
}

class Alert:
    def __init__(
        self,
        alert_type: str,
        priority: str,
        title: str,
        message: str,
        action_label: str = None,
        action_link: str = None,
        dismissible: bool = True,
        metadata: Dict[str, Any] = None
    ):
        self.id = str(uuid.uuid4())
        self.type = alert_type
        self.priority = priority
        self.title = title
        self.message = message
        self.action_label = action_label
        self.action_link = action_link
        self.dismissible = dismissible
        self.expires_at = None
        self.metadata = metadata or {}

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "priority": self.priority,
            "title": self.title,
            "message": self.message,
            "actionLabel": self.action_label,
            "actionLink": self.action_link,
            "dismissible": self.dismissible,
            "expiresAt": self.expires_at.isoformat() if self.expires_at else None,
            "metadata": self.metadata
        }


def check_default_credentials(user: models.User) -> List[Alert]:
    """Check if user is using default credentials"""
    # No longer applicable with database-based setup
    # Users create their own credentials during setup
    return []


def check_filament_inventory(db: Session) -> List[Alert]:
    """Check for low stock and out of stock filaments"""
    alerts = []
    
    # Get filaments that have purchase history (indicating they're being tracked in inventory)
    filaments_with_purchases = db.query(models.Filament).join(
        models.FilamentPurchase, models.Filament.id == models.FilamentPurchase.filament_id
    ).distinct().all()
    
    out_of_stock = []
    critical_stock = []
    low_stock = []
    
    for filament in filaments_with_purchases:
        # Check if user has set a minimum threshold for this filament
        if filament.min_filaments_kg is not None:
            # Alert if current quantity is below the user-defined minimum
            if filament.total_qty_kg <= filament.min_filaments_kg:
                if filament.total_qty_kg == 0:
                    out_of_stock.append(filament)
                elif filament.total_qty_kg <= ALERT_THRESHOLDS["filament_critical_stock_kg"]:
                    critical_stock.append(filament)
                else:
                    low_stock.append(filament)
    
    # Create alerts for out of stock filaments (0kg but with minimum threshold set)
    if out_of_stock:
        filament_names = [f"{f.color} {f.material} ({f.brand})" for f in out_of_stock[:3]]
        message = f"Out of stock: {', '.join(filament_names)}"
        if len(out_of_stock) > 3:
            message += f" and {len(out_of_stock) - 3} more"
        
        alerts.append(Alert(
            alert_type="inventory",
            priority="critical",
            title="Filaments Out of Stock",
            message=message,
            action_label="Manage Inventory",
            action_link="?tab=filaments",
            metadata={"filament_ids": [f.id for f in out_of_stock]}
        ))
    
    # Create alerts for critical stock
    if critical_stock:
        filament_names = [f"{f.color} {f.material} ({f.total_qty_kg:.1f}kg)" for f in critical_stock[:2]]
        message = f"Critical low stock: {', '.join(filament_names)}"
        if len(critical_stock) > 2:
            message += f" and {len(critical_stock) - 2} more"
        
        alerts.append(Alert(
            alert_type="inventory",
            priority="critical",
            title="Critical Low Stock",
            message=message,
            action_label="Order Now",
            action_link="?tab=filaments",
            metadata={"filament_ids": [f.id for f in critical_stock]}
        ))
    
    # Create alerts for low stock
    if low_stock:
        filament_names = [f"{f.color} {f.material} ({f.total_qty_kg:.1f}kg)" for f in low_stock[:2]]
        message = f"Low stock: {', '.join(filament_names)}"
        if len(low_stock) > 2:
            message += f" and {len(low_stock) - 2} more"
        
        alerts.append(Alert(
            alert_type="inventory",
            priority="warning",
            title="Low Stock Warning",
            message=message,
            action_label="Review Inventory",
            action_link="?tab=filaments",
            metadata={"filament_ids": [f.id for f in low_stock]}
        ))
    
    return alerts


def check_subscription_expiry(db: Session) -> List[Alert]:
    """Check for expiring subscriptions"""
    alerts = []
    
    # Get subscriptions (this is a simplified check)
    subscriptions = db.query(models.Subscription).all()
    
    # For this implementation, we'll create a business alert about subscription costs
    if subscriptions:
        total_cost = sum(s.price_eur or 0 for s in subscriptions)
        if total_cost > 100:  # Alert if monthly costs exceed €100
            alerts.append(Alert(
                alert_type="business",
                priority="info",
                title="High Subscription Costs",
                message=f"Monthly licensing costs: €{total_cost:.2f}. Review if all subscriptions are needed.",
                action_label="Review Licenses",
                action_link="?tab=subscriptions"
            ))
    
    return alerts


def check_printer_maintenance(db: Session) -> List[Alert]:
    """Check for printers needing maintenance (placeholder)"""
    alerts = []
    
    # This is a placeholder for future printer maintenance tracking
    # In a full implementation, you'd track printer usage hours
    printers = db.query(models.PrinterProfile).all()
    
    # Example: Alert if we have expensive printers (business insight)
    expensive_printers = [p for p in printers if p.price_eur > 1000]
    if expensive_printers:
        total_value = sum(p.price_eur for p in expensive_printers)
        alerts.append(Alert(
            alert_type="business",
            priority="info",
            title="High-Value Equipment",
            message=f"You have €{total_value:.0f} in premium printers. Consider maintenance tracking.",
            action_label="View Printers",
            action_link="?tab=printers"
        ))
    
    return alerts


def generate_alerts(user: models.User, db: Session) -> List[Dict[str, Any]]:
    """Generate all alerts for a user"""
    alerts = []
    
    # Security alerts
    alerts.extend(check_default_credentials(user))
    
    # Inventory alerts
    alerts.extend(check_filament_inventory(db))
    
    # Business alerts
    alerts.extend(check_subscription_expiry(db))
    alerts.extend(check_printer_maintenance(db))
    
    # Convert to dict format for JSON response
    return [alert.to_dict() for alert in alerts]