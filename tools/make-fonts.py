"""Makes static Rubik instances (fonts/*.ttf) from the variable Rubik fonts (google/fonts, OFL).
Unreal 4.26 renders a variable font at its default weight only, so each weight the game uses
gets its own static file.
    python tools/make-fonts.py <folder with Rubik[wght].ttf and Rubik-Italic[wght].ttf>
Needs fontTools (pip install fonttools)."""
import os, sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

src = sys.argv[1]
out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fonts")
os.makedirs(out, exist_ok=True)
WEIGHTS = {"Light": 300, "Regular": 400, "Medium": 500, "Bold": 700, "ExtraBold": 800, "Black": 900}
JOBS = [("Rubik[wght].ttf", w, f"Rubik-{w}.ttf") for w in WEIGHTS] + [
    ("Rubik-Italic[wght].ttf", "Regular", "Rubik-Italic.ttf"),
    ("Rubik-Italic[wght].ttf", "Medium", "Rubik-MediumItalic.ttf"),
    ("Rubik-Italic[wght].ttf", "Bold", "Rubik-BoldItalic.ttf"),
]
for name, weight, target in JOBS:
    font = TTFont(os.path.join(src, name))
    inst = instantiateVariableFont(font, {"wght": WEIGHTS[weight]}, updateFontNames=True)
    inst.save(os.path.join(out, target))
    print(target)
