from PIL import Image, ImageDraw
from pathlib import Path
root=Path(__file__).resolve().parent.parent/'build'
im=Image.new('RGBA',(64,64),(0,0,0,0));d=ImageDraw.Draw(im)
d.rounded_rectangle((0,0,63,63),radius=13,fill='#e6eadb')
d.rectangle((10,46,54,50),fill='#bac6a5');d.rectangle((13,49,52,52),fill='#a5b796')
d.rectangle((16,26,47,47),fill='#e7cfaa');d.rectangle((13,25,50,29),fill='#9a7e5c')
for i in range(8):d.rectangle((15+i*2,24-i*2,48-i*2,26-i*2),fill='#8a9c78')
d.rectangle((20,31,30,40),fill='#a2b9a5');d.rectangle((24,31,25,40),fill='#f1dfba');d.rectangle((20,35,30,36),fill='#f1dfba')
d.rectangle((36,33,42,47),fill='#b49a78');d.rectangle((39,39,40,40),fill='#f0d5a1')
d.rectangle((47,36,48,46),fill='#798d62');d.rectangle((44,32,47,36),fill='#97ab80');d.rectangle((48,29,52,33),fill='#7e9768');d.rectangle((45,45,50,48),fill='#c29875')
d.rectangle((24,43,29,46),fill='#ceb08b')
for i in [16,32,128,256,512]:
 for scale in [1,2]:im.resize((i*scale,i*scale),Image.Resampling.NEAREST).save(root/'icon.iconset'/f'icon_{i}x{i}{"@2x" if scale==2 else ""}.png')
im.resize((512,512),Image.Resampling.NEAREST).save(root/'icon.png')
im.resize((256,256),Image.Resampling.NEAREST).save(root/'icon.ico',sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])

im.resize((1024,1024),Image.Resampling.NEAREST).save(root/'icon.icns')
