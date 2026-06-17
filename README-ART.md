# Swapping in real ASCII art later

The README currently uses a geometric diamond placeholder. When you're ready to use an actual photo:

1. Pick a square-ish, high-contrast photo (simple backgrounds convert best).
2. Install a converter, e.g. `ascii-image-converter`:
   ```
   go install github.com/TheZoraiz/ascii-image-converter@latest
   ```
3. Generate the art:
   ```
   ascii-image-converter your-photo.jpg --color --width 40
   ```
4. Paste the output into the left-hand code block in `README.md`, replacing the diamond.

If you'd rather have it generated here, just upload the photo in chat and ask — it can be turned into matching ASCII text directly.
