const statusElement = document.getElementById('status');
const castButton = document.getElementById('castButton');
const verseCard = document.getElementById('verseCard');
const verseTextElement = document.getElementById('verseText');
const citationElement = document.getElementById('citation');
const sourceBadge = document.getElementById('sourceBadge');
const noteElement = document.getElementById('note');

const BOOKS_URL = './js/leb/books.json';
const VERSES_URL = './js/leb/verses.json';
const RANDOM_ORG_URL = (min, max) => `https://www.random.org/integers/?num=1&min=${min}&max=${max}&col=1&base=10&format=plain&rnd=new`;

const verseMap = new Map();
const chapterVerseCount = new Map();
let books = [];

function showStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle('text-rose-400', isError);
  statusElement.classList.toggle('text-slate-400', !isError);
}

function showVerseCard() {
  verseCard.classList.remove('hidden');
}

function hideVerseCard() {
  verseCard.classList.add('hidden');
}

function getVerseKey(book, chapter, verse) {
  return `${book}|${chapter}|${verse}`;
}

function parseVerseIndex(value) {
  const parts = value.toString().split('.');
  const chapter = Number(parts[0]);
  const verse = Number(parts[1].padStart(3, '0'));
  return { chapter, verse };
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return response.json();
}

async function buildBibleIndex() {
  showStatus('Loading local Bible data…');
  const [booksData, versesData] = await Promise.all([
    fetchJson(BOOKS_URL),
    fetchJson(VERSES_URL)
  ]);

  books = booksData;

  for (const entry of versesData) {
    const { chapter, verse } = parseVerseIndex(entry.verse);
    const key = getVerseKey(entry.book, chapter, verse);
    verseMap.set(key, entry.unformatted);

    const chapterKey = `${entry.book}|${chapter}`;
    chapterVerseCount.set(chapterKey, Math.max(chapterVerseCount.get(chapterKey) || 0, verse));
  }

  showStatus('Bible data loaded. Cast a lot to choose a verse.');
  castButton.disabled = false;
}

function getFallbackRandom(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function getRandomOrgInt(min, max) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(RANDOM_ORG_URL(min, max), { signal: controller.signal });
    if (!response.ok) {
      throw new Error('random.org request failed');
    }
    const text = (await response.text()).trim();
    const value = Number(text);
    if (!Number.isInteger(value)) {
      throw new Error('random.org returned invalid data');
    }
    return { value, source: 'random.org' };
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getRandomInt(min, max) {
  const remote = await getRandomOrgInt(min, max);
  if (remote) {
    return remote;
  }
  return { value: getFallbackRandom(min, max), source: 'local fallback' };
}

async function castLot() {
  try {
    castButton.disabled = true;
    hideVerseCard();
    showStatus('Casting lots…');

    const bookIndexResult = await getRandomInt(1, books.length);
    const bookIndex = bookIndexResult.value - 1;
    const selectedBook = books[bookIndex];

    const chapterIndexResult = await getRandomInt(1, selectedBook.chapters);
    const selectedChapter = chapterIndexResult.value;

    const chapterKey = `${selectedBook.osis}|${selectedChapter}`;
    const versesInChapter = chapterVerseCount.get(chapterKey) || 0;
    if (versesInChapter === 0) {
      throw new Error('Could not determine verse count for the selected chapter.');
    }

    const verseIndexResult = await getRandomInt(1, versesInChapter);
    const selectedVerse = verseIndexResult.value;

    const verseText = verseMap.get(getVerseKey(selectedBook.osis, selectedChapter, selectedVerse));
    if (!verseText) {
      throw new Error('Verse text not found locally.');
    }

    citationElement.textContent = `${selectedBook.human} ${selectedChapter}:${selectedVerse}`;
    verseTextElement.textContent = verseText;
    sourceBadge.textContent = `source: ${bookIndexResult.source} / ${chapterIndexResult.source} / ${verseIndexResult.source}`;
    noteElement.textContent = 'Verse text comes from the local LEB JSON data in js/leb/verses.json.';
    showVerseCard();
    showStatus('Lot cast successfully.');
  } catch (error) {
    showStatus(error.message || 'An error occurred while casting lots.', true);
  } finally {
    castButton.disabled = false;
  }
}

castButton.addEventListener('click', castLot);
window.addEventListener('DOMContentLoaded', buildBibleIndex);
