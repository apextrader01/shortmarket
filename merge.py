import re

with open('old_positions.jsx', 'r', encoding='utf8') as f:
    old_content = f.read()
    
with open('frontend/src/components/PositionsView.jsx', 'r', encoding='utf8') as f:
    cur_content = f.read()

# Extract table from old_positions.jsx
table_match = re.search(r'(<div className="glass-panel".*?</table>\n\s*</div>\n\s*</div>)', old_content, re.DOTALL)
if not table_match:
    print("Failed to find table HTML in old_positions.jsx")
    exit(1)
table_html = table_match.group(1)

# Extract cards from cur_content
cards_match = re.search(r'(<div style={{ display: \'grid\'.*?</div>\n\s*)}\n\n)', cur_content, re.DOTALL)
if not cards_match:
    print("Failed to find cards HTML in cur_content")
    exit(1)
cards_html = cards_match.group(1)

# Assemble
before = cur_content[:cards_match.start()]
after = cur_content[cards_match.end():]

# We must ensure cards_html does not include the ending `)}\n\n` because we want to wrap both in `<> ... </>\n      )}`
# Actually, the cards_match captures `</div>\n      )}\n\n`. We need to strip the `)}\n\n` part.
clean_cards = re.sub(r'}\)\s*}\s*$', '', cards_html.strip())

new_content = before + """<>
          <div className="desktop-view">
            """ + table_html + """
          </div>
          <div className="mobile-view">
            """ + clean_cards + """
          </div>
        </>
      )}

""" + after

with open('frontend/src/components/PositionsView.jsx', 'w', encoding='utf8') as f:
    f.write(new_content)

print("Merged correctly.")
