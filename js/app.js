const statusElement = document.getElementById('status');
const castButton = document.getElementById('castButton');
const retryButton = document.getElementById('retryButton');
const castModal = document.getElementById('castModal');
const closeModalButton = document.getElementById('closeModal');
const modalBookName = document.getElementById('modalBookName');
const modalChapterNumber = document.getElementById('modalChapterNumber');
const modalVerseNumber = document.getElementById('modalVerseNumber');
const modalTyping = document.getElementById('modalTyping');

const BOOKS_URL = '/js/leb/books.json';
const VERSES_URL = '/js/leb/verses.json';
const RANDOM_ORG_URL = (min, max) => `https://www.random.org/integers/?num=1&min=${min}&max=${max}&col=1&base=10&format=plain&rnd=new`;

const verseMap = new Map();
const chapterVerseCount = new Map();
let books = [];

function showStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle('text-rose-400', isError);
  statusElement.classList.toggle('text-slate-400', !isError);
}

function showModal() {
  castModal.classList.remove('hidden');
  castModal.classList.add('flex');
}

function hideModal() {
  castModal.classList.add('hidden');
  castModal.classList.remove('flex');
}

function resetModal() {
  modalBookName.textContent = '...';
  modalChapterNumber.textContent = '...';
  modalVerseNumber.textContent = '...';
  modalTyping.textContent = '';
  modalBookName.classList.remove('opacity-100');
  modalBookName.classList.add('opacity-0');
  modalChapterNumber.classList.remove('opacity-100');
  modalChapterNumber.classList.add('opacity-0');
  modalVerseNumber.classList.remove('opacity-100');
  modalVerseNumber.classList.add('opacity-0');
  closeModalButton.classList.add('hidden');
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
  retryButton.classList.add('hidden');
  retryButton.disabled = true;
  castButton.disabled = true;
  showStatus('Loading local Bible data…');

  try {
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
    retryButton.classList.add('hidden');
    retryButton.disabled = true;
    castButton.disabled = false;
  } catch (error) {
    showStatus(`Unable to load Bible data. ${error.message} Click Retry or refresh.`, true);
    retryButton.classList.remove('hidden');
    retryButton.disabled = false;
  }
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

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function revealText(element, text, hold = 1200) {
  element.textContent = text;
  element.classList.remove('opacity-0');
  element.classList.add('opacity-100');
  await pause(hold);
}

async function typeText(element, text, speed = 30) {
  element.textContent = '';
  for (const char of text) {
    element.textContent += char;
    await pause(speed);
  }
}

async function castLot() {
  try {
    showModal();
    resetModal();
    showStatus('Casting lots…');

    const bookIndexResult = await getRandomInt(1, books.length);
    const bookIndex = bookIndexResult.value - 1;
    const selectedBook = books[bookIndex];

    await revealText(modalBookName, selectedBook.human);
    await pause(800);

    const chapterIndexResult = await getRandomInt(1, selectedBook.chapters);
    const selectedChapter = chapterIndexResult.value;
    await revealText(modalChapterNumber, selectedChapter);
    await pause(800);

    const chapterKey = `${selectedBook.osis}|${selectedChapter}`;
    const versesInChapter = chapterVerseCount.get(chapterKey) || 0;
    if (versesInChapter === 0) {
      throw new Error('Could not determine verse count for the selected chapter.');
    }

    const verseIndexResult = await getRandomInt(1, versesInChapter);
    const selectedVerse = verseIndexResult.value;
    await revealText(modalVerseNumber, selectedVerse);
    await pause(800);

    const verseText = verseMap.get(getVerseKey(selectedBook.osis, selectedChapter, selectedVerse));
    if (!verseText) {
      throw new Error('Verse text not found locally.');
    }

    await typeText(modalTyping, verseText, 30);
    showStatus('Verse ready. Close the modal when you are done.');
  } catch (error) {
    showStatus(error.message || 'An error occurred while casting lots.', true);
    modalTyping.textContent = 'Unable to reveal the verse. Please try again.';
  } finally {
    closeModalButton.classList.remove('hidden');
    castButton.disabled = false;
  }
}

retryButton.addEventListener('click', async () => {
  retryButton.disabled = true;
  retryButton.textContent = 'Retrying…';
  await buildBibleIndex();
  retryButton.textContent = 'Retry';
});

castButton.addEventListener('click', castLot);
closeModalButton.addEventListener('click', hideModal);
window.addEventListener('DOMContentLoaded', buildBibleIndex);
