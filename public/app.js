document.getElementById('ocrForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const fileInput = document.getElementById('file');
  const taskInput = document.getElementById('task');
  const resultBlock = document.getElementById('result');
  const messageEl = document.getElementById('message');
  const ocrTextEl = document.getElementById('ocrText');
  const galleryEl = document.getElementById('gallery');

  const file = fileInput.files[0];
  if (!file) return alert('Будь ласка, виберіть зображення.');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('task', taskInput.value.trim());

  messageEl.textContent = '⏳ Обробка...';
  resultBlock.classList.remove('hidden');
  ocrTextEl.textContent = '';
  galleryEl.innerHTML = '';

  try {
    const res = await fetch('/api/vision', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    console.log('Response:', data);

    if (!res.ok || !data.found) {
      messageEl.textContent = '❌ Завдання не розпізнано.';
      return;
    }

    messageEl.textContent = data.message || '✅ Завдання розпізнано.';
    ocrTextEl.textContent = data.ocrText || '';

    const images = [];

    if (data.taskCrop) {
      images.push({ label: `Завдання ${data.task}`, src: data.taskCrop });
    }

    if (data.drawings && Array.isArray(data.drawings)) {
      for (const d of data.drawings) {
        images.push({ label: `Рисунок ${d.number}`, src: d.url });
      }
    }

    if (images.length) {
      images.forEach(img => {
        const div = document.createElement('div');
        div.innerHTML = `
          <figure>
            <img src="${img.src}" alt="${img.label}" />
            <figcaption>${img.label}</figcaption>
          </figure>`;
        galleryEl.appendChild(div);
      });
    }

  } catch (err) {
    console.error(err);
    messageEl.textContent = '💥 Помилка при обробці зображення.';
  }
});
