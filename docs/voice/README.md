# Zuri training: the narration lines, and the audio the player needs

**`training-lines.json`** holds every spoken line of Zuri's full training: 84 videos, in the order of the "Every Zuri video, in order" page (`preview/guides/videos.html`). Shape:

```json
[{ "video": "howtest", "group": "Everyone", "title": "How to test Zuri (2 min)", "lines": ["...", "..."] }, ...]
```

The extra `group` and `title` fields are for people reading the file. Only `video` and `lines` matter.

The lines are the exact strings the player shows as captions and speaks. They were taken by loading the lesson files (`preview/js/training.js` and `lessons_*.js`) and reading each step's `say`, not by retyping them. **Do not reword a line while recording.** The recorded clip is looked up by the exact text of the line.

The same line can appear in more than one video. The player then uses one clip for both. There are 729 lines in the file and 719 distinct ones.

## What the player needs to play a recorded voice

The player already plays recorded voice. No code change is needed. It works like this (`preview/js/training.js`, `clipFor` and `playClip`):

1. On load it fetches **`preview/voice/index.json`** (`fetch('voice/index.json?v=3')`). The shape is `{ "<exact line text>": ["voice/<file>", <seconds>] }`. The path in the value is relative to `preview/`.
2. For each line it is about to say, it looks the text up in that object. Found: it plays that file through one audio element. Not found: it falls back to the phone's own voice, which is the thing we are trying to get rid of.
3. `seconds` is the clip's duration. The player only uses it as a safety timeout, but it should be right (a clip that runs longer than 3 times its listed seconds plus 10 seconds is cut off).
4. The caption stays up while the clip plays, and the lesson moves to its next step when the clip ends. So the **length of a clip sets the pace of the video**, including any silence at the end.

**Files:**
- **Format:** AAC in an `.m4a` container. iPhones and iPads need this. Current clips are mono, about 40 kbit/s, 22.05 kHz.
- **Where:** `preview/voice/`.
- **Names:** one file per distinct line. The current naming is the first 12 hex characters of the MD5 of the line text, plus a suffix: `adf8b6e95541-r2.m4a`. Any unique name works, because the real link is the `index.json` entry. **Use a new suffix for a new recording (for example `-r3`), never reuse a name.** Phones and the offline cache keep the old file under the same name.
- **One voice only:** there is one voice for all videos.
- **Pacing:** the current clips have about half a second of silence added at the end so that captions have room. Keep that.

## When the clips are replaced

1. Write the new files and the new `index.json` into `preview/voice/`. Delete the old files.
2. In `preview/js/training.js`, raise the number in `voice/index.json?v=3`.
3. In `preview/sw.js`, raise the cache name (`zuri-v75`). The service worker keeps every clip a person has played, so without this a phone keeps playing the old voice.

## What a cloud chat cannot check

This container cannot play AAC and has no speech voice. A cloud chat can check that every line in `training-lines.json` has an entry in the new `index.json`, that every file exists and decodes, and that the listed seconds match the file. It cannot hear the result. Jerry listens on a phone before the change is merged.
