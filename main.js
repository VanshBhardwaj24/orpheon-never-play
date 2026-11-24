// Never Play: skips songs, artists and albums you never want to hear, and titles with words you list.
// Works at play time: on each new song it checks the list and, on a match, calls player.next().
// It cannot remove songs from playlists or Home (extensions can't filter the app's lists).
// Nothing is sent anywhere: no network action.

var MAX_BYTES = 450000;            // storage holds 512 KB; stay well under it
var MAX_IN_A_ROW = 5;              // after this many skips in a row, let songs play for a while
var PAUSE_MS = 10 * 60 * 1000;
var STREAK_GAP = 90 * 1000;        // skips further apart than this are not "in a row"

function get(key, fallback) { var v = myspoti.storage.get(key); return v === undefined || v === null ? fallback : v; }
function setting(key, fallback) { var v = myspoti.settings.get(key); return v === undefined || v === null ? fallback : v; }
// notify allows only 5 messages an hour, so it can throw: never let that stop a skip.
function tellUser(text) { try { myspoti.notify(String(text).slice(0, 200)); } catch (e) {} }
function say(text) { if (setting('tell', true)) tellUser(text); }
// For words: keep bracketed text, since "(Sped Up)" is where the word usually is.
function plain(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9À-￿]+/g, ' ').replace(/\s+/g, ' ').trim(); }

// "Song (Remastered 2011)" and "song" are the same song: lower case, no bracketed text, no punctuation.
function norm(s) {
  return String(s || '').toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9À-￿]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function firstArtist(text) { return String(text || '').split(/,| · | & | feat\.? /i)[0].trim(); }
function songKey(title, artist) { return norm(title) + '|' + norm(artist); }
function albumKey(album, artist) { return norm(album) + '|' + norm(artist); }

function load() { return { songs: get('songs', {}), artists: get('artists', {}), albums: get('albums', {}) }; }
function save(d) {
  var size = JSON.stringify(d).length;
  if (size > MAX_BYTES) { tellUser('Your Never Play list is full. Clear some of it in the settings.'); return false; }
  try {
    myspoti.storage.set('songs', d.songs); myspoti.storage.set('artists', d.artists); myspoti.storage.set('albums', d.albums);
  } catch (e) { tellUser('Could not save the list.'); return false; }
  return true;
}
function count(o) { return Object.keys(o).length; }

function words() {
  return String(setting('words', '')).split(',').map(function (w) { return plain(w); })
    .filter(function (w) { return w.length > 0; }).slice(0, 30);
}
function hasWord(title) {
  var padded = ' ' + plain(title) + ' ';
  var list = words();
  for (var i = 0; i < list.length; i++) if (padded.indexOf(' ' + list[i] + ' ') >= 0) return list[i];
  return null;
}

// Why a song is blocked, or null.
function reason(t, d) {
  var artists = (t.artists && t.artists.length) ? t.artists : [t.artist];
  if (d.songs[songKey(t.title, t.artist)]) return 'the song is on your list';
  for (var i = 0; i < artists.length; i++) if (artists[i] && d.artists[norm(artists[i])]) return artists[i] + ' is on your list';
  if (t.album && d.albums[albumKey(t.album, t.artist)]) return 'the album is on your list';
  var w = hasWord(t.title);
  if (w) return 'the title has "' + w + '"';
  return null;
}

// ---------- skipping ----------

myspoti.on('track', function (t) {
  var d = load();
  var why = reason(t, d);
  var now = Date.now();
  var s = get('streak', { n: 0, at: 0, pauseUntil: 0 });
  if (!why) { if (s.n) myspoti.storage.set('streak', { n: 0, at: 0, pauseUntil: s.pauseUntil }); return; }
  if (now < s.pauseUntil) return;
  var n = (now - s.at < STREAK_GAP ? s.n : 0) + 1;
  if (n > MAX_IN_A_ROW) {
    myspoti.storage.set('streak', { n: 0, at: 0, pauseUntil: now + PAUSE_MS });
    tellUser('Only blocked songs left here, so Never Play lets them play for 10 minutes.');
    return;
  }
  myspoti.player.next();
  myspoti.storage.set('streak', { n: n, at: now, pauseUntil: 0 });
  if (n === 1) say('Skipped ' + t.title + ': ' + why + '.');
});

// ---------- menu and player ----------

function target(kind, title, subtitle) {
  if (kind === 'track') return { kind: 'song', title: title, artist: firstArtist(subtitle) };
  if (kind === 'artist') return { kind: 'artist', name: title };
  if (kind === 'album') return { kind: 'album', title: title, artist: firstArtist(subtitle) };
  return null;
}
function isBlocked(x, d) {
  if (x.kind === 'song') return !!d.songs[songKey(x.title, x.artist)];
  if (x.kind === 'artist') return !!d.artists[norm(x.name)];
  return !!d.albums[albumKey(x.title, x.artist)];
}
function toggle(x) {
  var d = load();
  var on = !isBlocked(x, d);
  var what;
  if (x.kind === 'song') {
    var k = songKey(x.title, x.artist);
    if (on) d.songs[k] = { t: x.title, a: x.artist, at: Date.now() }; else delete d.songs[k];
    what = x.title;
  } else if (x.kind === 'artist') {
    if (on) d.artists[norm(x.name)] = Date.now(); else delete d.artists[norm(x.name)];
    what = x.name;
  } else {
    var ak = albumKey(x.title, x.artist);
    if (on) d.albums[ak] = Date.now(); else delete d.albums[ak];
    what = x.title;
  }
  if (!save(d)) return false;
  tellUser((on ? 'Never play: ' : 'Allowed again: ') + what);
  myspoti.ui.refresh('menu'); myspoti.ui.refresh('player');
  return on;
}

myspoti.provide('menu', function (t) {
  var d = load();
  var x = target(t.kind, t.title, t.subtitle);
  if (!x) return [];
  var out = [];
  if (x.kind === 'song') {
    out.push({ type: 'button', label: isBlocked(x, d) ? 'Play this song again' : 'Never play this song', icon: 'bolt', action: 'song' });
    if (x.artist) {
      var a = { kind: 'artist', name: x.artist };
      out.push({ type: 'button', label: (isBlocked(a, d) ? 'Allow ' : 'Never play ') + x.artist, icon: 'artist', action: 'artistOfSong' });
    }
  } else if (x.kind === 'artist') {
    out.push({ type: 'button', label: isBlocked(x, d) ? 'Allow this artist' : 'Never play this artist', icon: 'artist', action: 'artist' });
  } else {
    out.push({ type: 'button', label: isBlocked(x, d) ? 'Allow this album' : 'Never play this album', icon: 'album', action: 'album' });
  }
  return out.slice(0, 2).map(function (b) { b.label = b.label.slice(0, 40); return b; });
});

myspoti.provide('player', function (t) {
  var x = { kind: 'song', title: t.title, artist: t.artist };
  return [{ type: 'button', label: isBlocked(x, load()) ? 'Allow this song' : 'Never play this song', icon: 'bolt', action: 'now' }];
});

myspoti.provide('tap', function (e) {
  var c = e.context || {};
  if (e.action === 'now') {
    var cur = myspoti.player.current();
    if (!cur) return;
    if (toggle({ kind: 'song', title: cur.title, artist: cur.artist })) myspoti.player.next();
    return;
  }
  var x = target(c.kind, c.title, c.subtitle);
  if (!x) return;
  if (e.action === 'artistOfSong') x = { kind: 'artist', name: x.artist };
  if (e.action === 'song' || e.action === 'artist' || e.action === 'album' || e.action === 'artistOfSong') toggle(x);
});

// ---------- settings ----------

myspoti.on('setting', function (e) {
  if (e.key === 'show' && e.pressed) {
    var d = load();
    tellUser('Never play: ' + count(d.songs) + ' songs, ' + count(d.artists) + ' artists, ' + count(d.albums) + ' albums, ' + words().length + ' words.');
  }
  if (e.key === 'clear' && e.pressed) {
    save({ songs: {}, artists: {}, albums: {} });
    myspoti.storage.set('streak', { n: 0, at: 0, pauseUntil: 0 });
    tellUser('Your Never Play list is empty.');
  }
});
