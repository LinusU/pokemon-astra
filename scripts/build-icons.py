"""Dependency-free, original pixel UI icon generator (no cartridge graphics)."""
import struct
import zlib
from pathlib import Path

def inside(x, y, polygon):
    result = False
    j = len(polygon) - 1
    for i, (xi, yi) in enumerate(polygon):
        xj, yj = polygon[j]
        if (yi > y) != (yj > y) and x < (xj-xi)*(y-yi)/(yj-yi)+xi:
            result = not result
        j = i
    return result

def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind+data))

for size in (180, 192, 512):
    pixels = bytearray()
    star = [(16,5),(19,13),(27,16),(19,19),(16,27),(13,19),(5,16),(13,13)]
    core = [(16,10),(18,14),(22,16),(18,18),(16,22),(14,18),(10,16),(14,14)]
    for y in range(size):
        pixels.append(0)
        for x in range(size):
            xx, yy = x*32//size, y*32//size
            color = (28,60,54)
            if 3 <= xx <= 28 and 3 <= yy <= 28: color=(40,78,65)
            if inside(xx+.5, yy+.5, star): color=(214,180,104)
            if inside(xx+.5, yy+.5, core): color=(250,234,175)
            if (xx,yy) in [(5,6),(6,5),(25,25),(26,24)]: color=(142,186,147)
            pixels.extend(color)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB',size,size,8,2,0,0,0)) + chunk(b'IDAT',zlib.compress(pixels,9)) + chunk(b'IEND',b'')
    Path(f'public/icons/icon-{size}.png').write_bytes(png)
