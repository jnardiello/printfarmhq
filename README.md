# PrintFarmHQ

> Transform your 3D printing business with intelligent inventory management and cost tracking

## What is PrintFarmHQ?

PrintFarmHQ helps 3D printing businesses **save time and money** by automating the tedious parts of running a print farm:

### Smart Inventory Tracking
Never run out of filament mid-print again. Track stock levels across multiple materials and get alerts before you're empty.

### True Cost Calculator
Know your *real* profit margins. We calculate material costs, printer depreciation, electricity, and packaging—automatically.

### Multi-Material Support
Building complex products? Track which filaments each product needs and ensure you have everything in stock.

### 3D Model Library
Upload STL/3MF files and link them to products. Keep your designs organized and accessible.

### Fleet Management
Track multiple printers, their usage hours, and maintenance schedules. Know which machines are profitable.

## Quick Start

```bash
git clone https://github.com/yourusername/printfarmhq.git
cd printfarmhq
make install
make up
```

**That's it!** PrintFarmHQ is now running at http://localhost:3000

Login with the credentials you set during installation (or the defaults if you pressed Enter).

## Essential Commands

```bash
make up        # Start PrintFarmHQ
make down      # Stop PrintFarmHQ
```

## Prerequisites

You'll need:
- Docker & Docker Compose
- Make (usually pre-installed on Mac/Linux)
- ~2GB free disk space

## Security First

Before going live:

1. **Generate a secure JWT secret**
   ```bash
   echo "JWT_SECRET_KEY=$(openssl rand -hex 32)" >> backend/.env
   ```

2. **Change the admin password immediately after first login**

3. **Read the full security guide**: [docs/SECURITY.md](docs/SECURITY.md)

## Contributing

We love contributions! Whether it's:
- Bug reports
- Feature ideas
- Documentation improvements
- Code contributions

Check out our [GitHub Issues](https://github.com/yourusername/printfarmhq/issues) to get started.

## License

PrintFarmHQ uses **dual licensing**:

- **Open Source**: AGPL-3.0 for community use
- **Commercial**: Available for businesses who need proprietary modifications

For commercial licensing: **info@reltech.io**

See [LICENSE](LICENSE) for details.

## Get Help

- **Documentation**: [/docs](docs/)
- **Issues**: [GitHub Issues](https://github.com/yourusername/printfarmhq/issues)
- **Commercial Support**: info@reltech.io

---

Built with love for the 3D printing community
