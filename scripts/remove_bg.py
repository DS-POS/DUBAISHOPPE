from PIL import Image
import sys

def remove_background(input_path, output_path, light_threshold=200):
    """Replace ALL near-white/grey pixels with transparent. Keeps dark ink only."""
    img = Image.open(input_path).convert("RGBA")
    data = img.load()
    w, h = img.size

    for x in range(w):
        for y in range(h):
            r, g, b, a = data[x, y]
            # If pixel is light (near white or grey) -> transparent
            if r > light_threshold and g > light_threshold and b > light_threshold:
                data[x, y] = (r, g, b, 0)

    img.save(output_path, "PNG")
    print(f"Saved: {output_path}")

if __name__ == "__main__":
    inp = sys.argv[1] if len(sys.argv) > 1 else r"c:\Users\PC\Desktop\DS POS\public\stamp.png"
    out = sys.argv[2] if len(sys.argv) > 2 else r"c:\Users\PC\Desktop\DS POS\public\stamp_nobg.png"
    remove_background(inp, out)
