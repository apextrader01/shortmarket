import re

with open('frontend/src/components/PositionsView.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add data-label to td elements in the flatPositions.map block
# We will just do a simple replacement for padding or fontWeight attributes inside the td to add data-label.
# Because the td structure is known:

replacements = [
    (r'<td style={{ padding: \'16px 20px\' }}>', r'<td data-label="Symbol" style={{ padding: \'16px 20px\' }}>'),
    (r'<td style={{ fontWeight: \'600\', color: pos.qty > 0', r'<td data-label="Side" style={{ fontWeight: \'600\', color: pos.qty > 0'),
    (r'<td style={{ fontWeight: \'700\', color: \'var\(--text-primary\)\' }}>', r'<td data-label="Net Qty" style={{ fontWeight: \'700\', color: \'var(--text-primary)\' }}>'),
    (r'<td style={{ fontWeight: \'500\' }}>.?.?\{pos.avg.toFixed\(2\)\}<\/td>', r'<td data-label="Avg. Price" style={{ fontWeight: \'500\' }}>?{pos.avg.toFixed(2)}</td>'),
    (r'<td style={{ fontWeight: \'500\' }}>\s*\{viewMode === \'CLOSED\'', r'<td data-label="LTP" style={{ fontWeight: \'500\' }}>\n                        {viewMode === \'CLOSED\''),
    (r'<td style={{ fontWeight: \'700\', color: viewMode === \'CLOSED\' \? \'var\(--text-muted\)\' : \(isProfit', r'<td data-label="Unrealized P&L" style={{ fontWeight: \'700\', color: viewMode === \'CLOSED\' ? \'var(--text-muted)\' : (isProfit'),
    (r'<td style={{ fontWeight: \'700\', color: realizedPnl > 0', r'<td data-label="Realized P&L" style={{ fontWeight: \'700\', color: realizedPnl > 0'),
    (r'<td style={{ fontWeight: \'500\' }}>\{pos.segment\}<\/td>', r'<td data-label="Segment" style={{ fontWeight: \'500\' }}>{pos.segment}</td>'),
    (r'<td style={{ fontWeight: \'500\' }}>\{pos.exchange\}<\/td>', r'<td data-label="Exchange" style={{ fontWeight: \'500\' }}>{pos.exchange}</td>'),
    (r'<td style={{ fontWeight: \'500\' }}>\{pos.productLabel\}<\/td>', r'<td data-label="Product" style={{ fontWeight: \'500\' }}>{pos.productLabel}</td>'),
    (r'<td style={{ textAlign: \'center\', paddingRight: \'20px\' }}>', r'<td data-label="Actions" style={{ textAlign: \'center\', paddingRight: \'20px\' }}>'),
]

for old, new in replacements:
    content = re.sub(old, new, content)

with open('frontend/src/components/PositionsView.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
