content = open(r'e:\webapp\Dashboard\Salsoft\finance-dashboard.html', encoding='utf-8').read()

replacements = [
    ("font-family: 'DM Sans', sans-serif;", "font-family: 'Aptos Narrow', 'Arial Narrow', Arial, sans-serif;"),
    ("font-family: 'DM Mono', monospace;", "font-family: 'Aptos Narrow', 'Arial Narrow', Arial, sans-serif;"),
    ("font-family: 'Playfair Display', serif;", "font-family: 'Aptos Narrow', 'Arial Narrow', Arial, sans-serif;"),
    ("font-family:'DM Sans'", "font-family:'Aptos Narrow','Arial Narrow',Arial,sans-serif"),
    ("font-family:'DM Mono'", "font-family:'Aptos Narrow','Arial Narrow',Arial,sans-serif"),
    ("family:'DM Sans'", "family:'Aptos Narrow','Arial Narrow',Arial,sans-serif"),
    ("family:'DM Mono'", "family:'Aptos Narrow','Arial Narrow',Arial,sans-serif"),
]

for old, new in replacements:
    count = content.count(old)
    content = content.replace(old, new)
    print(f"Replaced {count}x: {old[:40]}")

open(r'e:\webapp\Dashboard\Salsoft\finance-dashboard.html', 'w', encoding='utf-8').write(content)
print('Done. Total Aptos Narrow occurrences:', content.count('Aptos Narrow'))
