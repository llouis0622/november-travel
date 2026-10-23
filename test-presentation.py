"""Static markup, stylesheet delimiter, and declared color checks; no browser rendering."""
from pathlib import Path
from html.parser import HTMLParser
import json,re
class Audit(HTMLParser):
    void={'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
    def __init__(self): super().__init__(); self.stack=[];self.ids=set();self.controls=0
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if 'id' in attrs:
            assert attrs['id'] not in self.ids, ('duplicate id',attrs['id'])
            self.ids.add(attrs['id'])
        if tag in {'button','input','select','a'}:
            assert 'button' not in self.stack,('interactive element inside button',tag)
            self.controls+=1
        if tag not in self.void:self.stack.append(tag)
    def handle_endtag(self,tag):
        if tag in self.void:return
        assert self.stack and self.stack[-1]==tag,('mismatched tag',tag,self.stack[-6:])
        self.stack.pop()
    def handle_startendtag(self,tag,attrs):
        self.handle_starttag(tag,attrs)
        if tag not in self.void:self.handle_endtag(tag)

def audit(text):
    p=Audit();p.feed(text);p.close();assert not p.stack,p.stack;return p.controls
html=Path('travel.html').read_text()
controls=audit(html)
fragments=json.loads(Path('/tmp/travel-edit-fragments.json').read_text())
for f in fragments:
    try:controls+=audit(f['html'])
    except AssertionError as e:raise AssertionError((f['name'],str(e)))
assert '<title>11 Travel</title>' in html
assert Path('dist/index.html').read_bytes()==Path('travel.html').read_bytes()
assert not re.search(r'<(?:script|link)[^>]+(?:src|href)=',html), 'standalone release has unexpected external code/styles'
css=Path('ui.css').read_text()
# Check nested delimiters, comments and strings without pretending to compute layout.
clean=re.sub(r'/\*.*?\*/','',css,flags=re.S)
clean=re.sub(r'''"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*' ''','',clean,flags=re.X)
stack=[]
for c in clean:
    if c in '{([':stack.append(c)
    elif c in '})]':assert stack and stack.pop()=={'}':'{',')':'(',']':'['}[c]
assert not stack
for width in ['1199px','900px','600px','380px']:
    assert '@media(max-width:'+width+')' in css
assert '@media(max-height:550px)' in css and '@media(pointer:coarse)' in css
assert 'prefers-reduced-motion' in css and 'focus-visible' in css

def luminance(h):
    c=[int(h[i:i+2],16)/255 for i in (1,3,5)]
    c=[x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in c]
    return sum(a*b for a,b in zip(c,[.2126,.7152,.0722]))
def contrast(a,b):
    x,y=sorted((luminance(a),luminance(b)));return(y+.05)/(x+.05)
pairs=[('main','#f3f2ef','#1a1b1e'),('muted','#a8a9af','#1a1b1e'),('candidate description','#c6c7cd','#1e1f23'),('visit title','#f4e5be','#413a2a'),('transfer','#c5d4ea','#2a303a'),('wait','#b9bbc6','#212226'),('button','#19160f','#ead39b'),('stop metadata','#aeb1bc','#242529'),('timeline hours','#b4b5be','#191a1d'),('selected chip','#d2bf95','#2d2a22')]
for label,fg,bg in pairs:
    ratio=contrast(fg,bg);assert ratio>=4.5,(label,ratio)
print(f'Static HTML passed: {len(fragments)+1} document/fragments, {controls} controls; CSS delimiters and {len(pairs)} text contrast pairs passed (minimum {min(contrast(a,b) for _,a,b in pairs):.2f}:1).')
