const fs = require('fs');
const path = require('path');

const files = [
    "Assets.tsx",
    "asset_history.tsx",
    "BankMatching.tsx",
    "Billings.tsx",
    "Consumables.tsx",
    "Contracts.tsx",
    "Customers.tsx",
    "Deliveries.tsx",
    "Products.tsx",
    "rent_assets.tsx",
    "Repairs.tsx",
    "Vendors.tsx"
];

for (const f of files) {
    const fullPath = path.join('src', 'pages', f);
    if (!fs.existsSync(fullPath)) continue;
    
    const content = fs.readFileSync(fullPath, 'utf-8');
    const match = content.match(/const\s+(\w+)\s*=\s*[a-zA-Z0-9_.]+\.map\s*\((.*?)\s*=>\s*({(?:[^{}]*|{[^{}]*})*})\s*\)/s);
    if (match) {
        console.log(`\n--- ${f} ---`);
        console.log(match[0]);
    }
}
