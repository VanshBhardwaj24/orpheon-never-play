# Never Play

An [Orpheon](https://github.com/kota-zo/Orpheon) extension. Free and open source. If it helps you, ☕ [Ko-fi](https://ko-fi.com/vanshmusic) · a 👍 on the Ratings issue of the store also helps other people find it.

<!-- screenshot: the ⋯ menu showing "Never play this song" / "Never play <artist>" -->

- **Never play a song, artist or album.** Tap ⋯ on it, or use the button under the player.
- **Skip by word.** List words like `sped up, slowed, nightcore, karaoke` in the settings and any title containing them is skipped.
- **Works offline.** No network access at all: your list stays on your phone.

## How it works
When a new song starts, Never Play checks it against your list and calls "next" if it matches. Songs are matched by cleaned-up title and artist (brackets and punctuation ignored), so the same song from another source is caught too.

## Limits
- It skips at play time. It cannot remove songs from playlists or Home (extensions can't change the app's lists).
- A song you pick yourself is skipped too if it is on the list. A notice tells you why.
- After 5 skips in a row it lets songs play for 10 minutes, so a list made only of blocked songs never loops.
- Notices are limited by Orpheon to 5 an hour, so only the first skip of a run is announced.

## Support
It is free. If you want to help, a ☕ on [Ko-fi](https://ko-fi.com/vanshmusic) pays for time on updates. Also by me: [Fresh Home](https://github.com/VanshBhardwaj24/orpheon-fresh-home), new releases and charts on Home.
