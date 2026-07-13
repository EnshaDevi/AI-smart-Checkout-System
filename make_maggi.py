from PIL import Image, ImageDraw
img = Image.new('RGB', (200, 200), color=(255, 215, 0))
d = ImageDraw.Draw(img)
d.text((60, 90), 'MAGGI (Scan Me)', fill=(255, 0, 0))
img.save('static/maggi.png')
