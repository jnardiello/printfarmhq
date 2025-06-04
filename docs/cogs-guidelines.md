# Calculating COGS

COGS is calculated and visible in Print Jobs>Print Queue, column: Calculated COGS. We have two metrics that must contribute to COGS:

- COP (Cost of production): which is calculated in Inventory>Products and is the result of the sum of filaments cost+additional parts cost. This must be calculated in product creation and product update.

- COGS: which is calculated as the COP+Cost of Printers+Cost of packaging and is part of Print Job Queue, it's calculated when we create or update a print job.

So, in a nutshell:

COP=Cost of filaments+Cost of additional parts
COGS=COP+Cost of printers+Cost of packaging


