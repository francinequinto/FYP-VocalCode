# scraper.py
def get_canvas_state():
    # to inspect the UI objects (i.e. sprites, backdrops)
    return {
        "sprites": [
            {"id": "knight", "x": 100, "y": 200},
            {"id": "dragon", "x": 300, "y": 200}
        ],
        "backdrop": "castle_interior"
    }