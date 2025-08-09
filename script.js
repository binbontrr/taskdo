let initialTime;
let accumulatedTime = 0;
let timerHandler;

const timeDisplay = document.querySelector('.timer-display');
const beginBtn = document.getElementById('startBtn');
const haltBtn = document.getElementById('stopBtn');
const restartBtn = document.getElementById('resetBtn');
const taskInput = document.getElementById('todoInput');
const addTaskBtn = document.getElementById('addTodo');
const taskList = document.getElementById('todoList');
const pastTasksContainer = document.getElementById('oldTodosContainer');
const storeBtn = document.getElementById('archiveBtn');
const togglePastBtn = document.getElementById('toggleHistoryBtn');

const notification = document.getElementById('popup');
const closeNotif = document.querySelector('.popup-close');
const notifTitle = document.querySelector('.popup-header h3');
const notifContent = document.querySelector('.popup-body p');

function currentDateString() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function migrateLegacyStorage() {
    try {
        const legacy = localStorage.getItem('todos');
        const modern = localStorage.getItem('tasks');
        if (!modern && legacy) {
            const parsed = JSON.parse(legacy);
            const migrated = {
                active: Array.isArray(parsed?.current) ? parsed.current : [],
                completed: parsed?.history && typeof parsed.history === 'object' ? parsed.history : {},
                timeRecords: parsed?.timerHistory && typeof parsed.timerHistory === 'object' ? parsed.timerHistory : {}
            };
            localStorage.setItem('tasks', JSON.stringify(migrated));
        }
    } catch (e) {
        console.warn('Storage migration failed:', e);
    }
}

function formatDateValue(dateValue) {
    const dt = new Date(dateValue);
    return dt.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function convertTime(msValue) {
    const hrs = Math.floor(msValue / 3600000);
    const mins = Math.floor((msValue % 3600000) / 60000);
    const secs = Math.floor((msValue % 60000) / 1000);
    
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getTimeColor(msDuration) {
    const hoursVal = msDuration / 3600000;
    if (hoursVal < 2) return 'timer-blue';
    if (hoursVal < 4) return 'timer-green';
    if (hoursVal < 8) return 'timer-orange';
    if (hoursVal < 10) return 'timer-red';
    if (hoursVal >= 10) return 'timer-purple';
    return '';
}

function updateTimeColor(elementRef, msDuration) {
    const colorOptions = ['timer-blue', 'timer-green', 'timer-orange', 'timer-red', 'timer-purple'];
    elementRef.classList.remove(...colorOptions);
    if (elementRef === timeDisplay || (elementRef.classList && elementRef.classList.contains('timer-display'))) {
        return;
    }
    const colorClass = getTimeColor(msDuration);
    if (colorClass) elementRef.classList.add(colorClass);
}

function beginTimer() {
    initialTime = Date.now() - accumulatedTime;
    timerHandler = setInterval(() => {
        accumulatedTime = Date.now() - initialTime;
        timeDisplay.textContent = convertTime(accumulatedTime);
        updateTimeColor(timeDisplay, accumulatedTime);   
        storeTimer(); 
    }, 11);
    
    beginBtn.disabled = true;
    haltBtn.disabled = false;
    timeDisplay.classList.add('active');

    confetti({
        particleCount: 52,
        spread: 72,
        origin: { y: 0.61 },
        colors: ['#ff0101', '#01ff01', '#810081'],
        ticks: 201
    });
}

function haltTimer() {
    clearInterval(timerHandler);
    beginBtn.disabled = false;
    haltBtn.disabled = true;
    timeDisplay.classList.remove('active');
    storeTimer(); 
}

function restartTimer() {
    clearInterval(timerHandler);
    accumulatedTime = 0;
    timeDisplay.textContent = '00:00:00';
    updateTimeColor(timeDisplay, 0);
    beginBtn.disabled = false;
    haltBtn.disabled = false;
    timeDisplay.classList.remove('active');
    let storedData = JSON.parse(localStorage.getItem('tasks'));
    if (!storedData) {
        storedData = {
            active: [],
            completed: {},
            timeRecords: {}
        };
    }
    const todayVal = currentDateString();
    if (storedData.timeRecords[todayVal]) {
        delete storedData.timeRecords[todayVal];
        localStorage.setItem('tasks', JSON.stringify(storedData));
    }
    storeTimer();
}

function createTaskElement(taskItem, isCompleted = false, dateKey = null, taskIndex = null) {
    const listItem = document.createElement('li');
    listItem.className = isCompleted ? 'old-todo-item' : 'todo-item';
    if (taskItem.completed) listItem.classList.add('completed');

    const checkBox = document.createElement('input');
    checkBox.type = 'checkbox';
    checkBox.checked = taskItem.completed;
    checkBox.addEventListener('change', () => {
        listItem.classList.toggle('completed');
        if (!isCompleted) {
            let storedData = JSON.parse(localStorage.getItem('tasks'));
            if (!storedData) {
                storedData = {
                    active: [],
                    completed: {},
                    timeRecords: {}
                };
            }
            let idx = storedData.active.findIndex(t => t.id === taskItem.id);
            if (idx !== -1) {
                storedData.active[idx].completed = checkBox.checked;
                taskItem.completed = checkBox.checked;
                localStorage.setItem('tasks', JSON.stringify(storedData));
            }
            updateCompletion();
        }
    });

    const spanEl = document.createElement('span');
    spanEl.textContent = taskItem.text;
    spanEl.style.cursor = 'pointer';

    if (!isCompleted) {
        spanEl.addEventListener('click', () => {
            const inputArea = document.createElement('textarea');
            inputArea.value = taskItem.note || '';
            inputArea.className = 'note-textarea';

            const saveButton = document.createElement('button');
            saveButton.textContent = 'Save';
            saveButton.className = 'note-save-btn';

            const popupBackground = document.createElement('div');
            popupBackground.className = 'popup-bg';

            const popupContent = document.createElement('div');
            popupContent.className = 'popup-box note-editor';

            const headerSection = document.createElement('div');
            headerSection.className = 'note-editor-header';
            const titleElement = document.createElement('h3');
            titleElement.textContent = 'Add/Edit Note';
            const closeButton = document.createElement('button');
            closeButton.innerHTML = '&times;';
            closeButton.className = 'popup-close-btn';
            closeButton.onclick = () => document.body.removeChild(popupBackground);
            headerSection.appendChild(titleElement);
            headerSection.appendChild(closeButton);
            popupContent.appendChild(headerSection);

            const textArea = document.createElement('textarea');
            textArea.className = 'note-textarea';
            textArea.placeholder = 'Write your note here...';
            textArea.maxLength = 501;
            textArea.rows = 7;
            textArea.value = taskItem.note || '';
            popupContent.appendChild(textArea);

            const footerSection = document.createElement('div');
            footerSection.className = 'note-editor-footer';
            const counterEl = document.createElement('div');
            counterEl.className = 'note-counter';
            const updateCount = () => {
                counterEl.textContent = `${textArea.value.length}/501`;
            };
            updateCount();
            textArea.addEventListener('input', updateCount);

            const actionButtons = document.createElement('div');
            actionButtons.className = 'note-actions';
            const cancelButton = document.createElement('button');
            cancelButton.textContent = 'Cancel';
            cancelButton.className = 'note-cancel-btn';
            cancelButton.onclick = () => document.body.removeChild(popupBackground);
            const saveButton2 = document.createElement('button');
            saveButton2.textContent = 'Save';
            saveButton2.className = 'note-save-btn';
            saveButton2.onclick = () => {
                taskItem.note = textArea.value;
                let storedData = JSON.parse(localStorage.getItem('tasks'));
                if (!storedData) {
                    storedData = {
                        active: [],
                        completed: {},
                        timeRecords: {}
                    };
                }
                let idx = storedData.active.findIndex(t => t.id === taskItem.id);
                if (idx !== -1) {
                    storedData.active[idx].note = textArea.value;
                    localStorage.setItem('tasks', JSON.stringify(storedData));
                }
                localStorage.setItem('tasks', JSON.stringify(JSON.parse(localStorage.getItem('tasks'))));
                const hasNoteContent = (textArea.value || '').trim() !== '';
                if (hasNoteContent) {
                    if (!noteIndicator) {
                        noteIndicator = document.createElement('span');
                        noteIndicator.className = 'note-badge';
                        noteIndicator.textContent = 'Has Note';
                        listItem.appendChild(noteIndicator);
                    }
                } else if (noteIndicator) {
                    noteIndicator.remove();
                    noteIndicator = null;
                }
                document.body.removeChild(popupBackground);
            };

            actionButtons.appendChild(cancelButton);
            actionButtons.appendChild(saveButton2);
            footerSection.appendChild(counterEl);
            footerSection.appendChild(actionButtons);
            popupContent.appendChild(footerSection);

            popupBackground.appendChild(popupContent);
            document.body.appendChild(popupBackground);

            textArea.focus();
            textArea.selectionStart = textArea.selectionEnd = textArea.value.length;
            textArea.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    saveButton2.click();
                }
                if (e.key === 'Escape') {
                    cancelButton.click();
                }
            });

            popupBackground.onclick = e => {
                if (e.target === popupBackground) document.body.removeChild(popupBackground);
            };
        });
    } else {
        if (taskItem.note && taskItem.note.trim() !== '') {
            const noteTooltip = document.createElement('div');
            noteTooltip.className = 'todo-note-tooltip';
            noteTooltip.textContent = taskItem.note;
            noteTooltip.style.display = 'none';
            noteTooltip.style.position = 'fixed';
            noteTooltip.style.pointerEvents = 'none';
            noteTooltip.style.background = '#23232c';
            noteTooltip.style.color = '#fff';
            noteTooltip.style.padding = '9px 15px';
            noteTooltip.style.borderRadius = '9px';
            noteTooltip.style.boxShadow = '0 5px 17px rgba(0,0,0,0.27)';
            noteTooltip.style.maxWidth = '251px';
            noteTooltip.style.whiteSpace = 'pre-wrap';
            noteTooltip.style.zIndex = '10000';
            noteTooltip.style.fontSize = '0.97em';
            noteTooltip.style.opacity = '0.99';

            document.body.appendChild(noteTooltip);
            spanEl.addEventListener('mouseenter', (e) => {
                noteTooltip.style.display = 'block';
            });
            spanEl.addEventListener('mousemove', (e) => {
                noteTooltip.style.left = (e.clientX - 16) + 'px';
                noteTooltip.style.top = (e.clientY + 11) + 'px';
            });
            spanEl.addEventListener('mouseleave', () => {
                noteTooltip.style.display = 'none';
            });
            listItem.addEventListener('mouseleave', () => {
                noteTooltip.style.display = 'none';
            });
        }
    }

    listItem.appendChild(checkBox);
    listItem.appendChild(spanEl);

    let noteIndicator = null;
    if (!isCompleted && taskItem.note && taskItem.note.trim() !== '') {
        noteIndicator = document.createElement('span');
        noteIndicator.className = 'note-badge';
        noteIndicator.textContent = 'Note';
        listItem.appendChild(noteIndicator);
    }

    if (!isCompleted) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'delete-btn';
        removeBtn.textContent = 'Remove';
        removeBtn.onclick = () => {
            const confirmPopup = document.createElement('div');
            confirmPopup.className = 'popup-bg';
            const popupBox = document.createElement('div');
            popupBox.className = 'popup-box';
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '&times;';
            closeBtn.className = 'popup-close-btn';
            closeBtn.onclick = () => document.body.removeChild(confirmPopup);
            popupBox.appendChild(closeBtn);
            const icon = document.createElement('div');
            icon.innerHTML = '&#x26A0;';
            icon.style.fontSize = '2.1em';
            icon.style.textAlign = 'center';
            popupBox.appendChild(icon);
            const title = document.createElement('h3');
            title.textContent = 'Confirm deletion?';
            title.style.textAlign = 'center';
            popupBox.appendChild(title);
            const msg = document.createElement('p');
            msg.textContent = 'This action cannot be undone.';
            msg.style.textAlign = 'center';
            popupBox.appendChild(msg);
            const btnContainer = document.createElement('div');
            btnContainer.style.display = 'flex';
            btnContainer.style.gap = '11px';
            btnContainer.style.margin = '19px 0 0 0';
            btnContainer.style.justifyContent = 'center';
            const confirmBtn = document.createElement('button');
            confirmBtn.textContent = 'Delete';
            confirmBtn.className = 'note-save-btn';
            confirmBtn.style.background = '#ff3c31';
            confirmBtn.onclick = () => {
                let storedData = JSON.parse(localStorage.getItem('tasks'));
                storedData.active = storedData.active.filter(t => t.id !== taskItem.id);
                localStorage.setItem('tasks', JSON.stringify(storedData));
                listItem.remove();
                document.body.removeChild(confirmPopup);
                updateCompletion();
            };
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.className = 'note-save-btn';
            cancelBtn.onclick = () => document.body.removeChild(confirmPopup);
            btnContainer.appendChild(confirmBtn);
            btnContainer.appendChild(cancelBtn);
            popupBox.appendChild(btnContainer);
            confirmPopup.appendChild(popupBox);
            confirmPopup.onclick = e => { if (e.target === confirmPopup) document.body.removeChild(confirmPopup); };
            document.body.appendChild(confirmPopup);
        };
        listItem.appendChild(removeBtn);
    }

    return listItem;
}

function updateCompletion() {
    const percentElement = document.getElementById('progressPercent');
    const fillElement = document.getElementById('progressFill');
    if (!percentElement || !fillElement) return;
    let storedData = JSON.parse(localStorage.getItem('tasks'));
    if (!storedData) {
        storedData = { active: [], completed: {}, timeRecords: {} };
    }
    const totalTasks = storedData.active.length;
    const completedTasks = storedData.active.filter(t => t.completed).length;
    const rawPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
    const finalPercent = Math.max(0, Math.min(100, rawPercent));
    percentElement.textContent = finalPercent + '%';
    fillElement.style.width = finalPercent + '%';
}

function addNewTask() {
    const taskText = taskInput.value.trim();
    if (taskText === '') return;

    const newTask = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        text: taskText,
        completed: false,
        note: ''
    };

    let storedData = JSON.parse(localStorage.getItem('tasks'));
    if (!storedData) {
        storedData = {
            active: [],
            completed: {},
            timeRecords: {}
        };
    }
    storedData.active.push(newTask);
    localStorage.setItem('tasks', JSON.stringify(storedData));

    const listItem = createTaskElement(newTask);
    taskList.appendChild(listItem);
    taskInput.value = '';
    localStorage.setItem('tasks', JSON.stringify(JSON.parse(localStorage.getItem('tasks'))));
    updateCompletion();
}

function loadTasks() {
    let storedData = JSON.parse(localStorage.getItem('tasks'));
    if (!storedData) {
        storedData = {
            active: [],
            completed: {},
            timeRecords: {}
        };
        localStorage.setItem('tasks', JSON.stringify(storedData));
    }
    let changed = false;
    storedData.active = storedData.active.map(t => {
        if (!t.id) {
            changed = true;
            return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), ...t };
        }
        return t;
    });
    if (changed) localStorage.setItem('tasks', JSON.stringify(storedData));
    const todayDate = currentDateString();

    taskList.innerHTML = '';
    storedData.active.forEach(task => {
        taskList.appendChild(createTaskElement(task));
    });
    updateCompletion();

    pastTasksContainer.innerHTML = '';

    const sortedDates = Object.keys(storedData.completed)
        .sort((a, b) => new Date(b.split('_')[0]) - new Date(a.split('_')[0]) || b.localeCompare(a));
    
    sortedDates.forEach(date => {
        const card = document.createElement('div');
        card.className = 'old-todo-card';
        
        const dateElement = document.createElement('div');
        dateElement.className = 'old-todo-date';

        let displayDate = date;
        let displayTime = '';
        if (date.includes('_')) {
            const [d, t] = date.split('_');
            displayDate = d;
            if (t && t.length === 6) {
                displayTime = ' ' + t.slice(0,2) + ':' + t.slice(2,4) + ':' + t.slice(4,6);
            }
        }
        dateElement.textContent = formatDateValue(displayDate) + displayTime;

        if (storedData.timeRecords[date]) {
            const timerElement = document.createElement('div');
            timerElement.className = 'old-todo-timer';
            timerElement.textContent = '⏱️ ' + storedData.timeRecords[date].formattedTime;
            updateTimeColor(timerElement, storedData.timeRecords[date].time);
            dateElement.appendChild(timerElement);
        }
        
        const itemsContainer = document.createElement('ul');
        itemsContainer.className = 'old-todo-items';
        
        storedData.completed[date].forEach((task, idx) => {
            itemsContainer.appendChild(createTaskElement(task, true, date, idx));
        });
        
        const removeCardBtn = document.createElement('button');
        removeCardBtn.className = 'delete-card-btn';
        removeCardBtn.textContent = 'Remove';
        removeCardBtn.onclick = () => {
            const confirmPopup = document.createElement('div');
            confirmPopup.className = 'popup-bg';
            const popupBox = document.createElement('div');
            popupBox.className = 'popup-box';
            
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '&times;';
            closeBtn.className = 'popup-close-btn';
            closeBtn.onclick = () => document.body.removeChild(confirmPopup);
            popupBox.appendChild(closeBtn);
            
            const icon = document.createElement('div');
            icon.innerHTML = '&#x26A0;';
            icon.style.fontSize = '2.1em';
            icon.style.textAlign = 'center';
            popupBox.appendChild(icon);
            
            const title = document.createElement('h3');
            title.textContent = 'Confirm permanent deletion?';
            title.style.textAlign = 'center';
            popupBox.appendChild(title);
            
            const msg = document.createElement('p');
            msg.textContent = 'All data for this date will be erased.';
            msg.style.textAlign = 'center';
            popupBox.appendChild(msg);

            const btnContainer = document.createElement('div');
            btnContainer.style.display = 'flex';
            btnContainer.style.gap = '11px';
            btnContainer.style.margin = '19px 0 0 0';
            btnContainer.style.justifyContent = 'center';
            const confirmBtn = document.createElement('button');
            confirmBtn.textContent = 'Delete';
            confirmBtn.className = 'note-save-btn';
            confirmBtn.style.background = '#ff3c31';
            confirmBtn.onclick = () => {
                delete storedData.completed[date];
                delete storedData.timeRecords[date];
                localStorage.setItem('tasks', JSON.stringify({
                    active: storedData.active,
                    completed: storedData.completed,
                    timeRecords: storedData.timeRecords
                }));
                loadTasks();
                document.body.removeChild(confirmPopup);
            };
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.className = 'note-save-btn';
            cancelBtn.onclick = () => document.body.removeChild(confirmPopup);
            btnContainer.appendChild(confirmBtn);
            btnContainer.appendChild(cancelBtn);
            popupBox.appendChild(btnContainer);
            confirmPopup.appendChild(popupBox);
            confirmPopup.onclick = e => { if (e.target === confirmPopup) document.body.removeChild(confirmPopup); };
            document.body.appendChild(confirmPopup);
        };
        
        card.appendChild(dateElement);
        card.appendChild(itemsContainer);
        card.appendChild(removeCardBtn);
        pastTasksContainer.appendChild(card);
    });
}

function displayNotification(titleText, messageText) {
    notifTitle.textContent = titleText;
    notifContent.textContent = messageText;
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3100);
}

closeNotif.addEventListener('click', () => {
    notification.classList.remove('show');
});

function storeCurrentTasks() {
    let storedData = JSON.parse(localStorage.getItem('tasks'));
    if (!storedData) {
        storedData = {
            active: [],
            completed: {},
            timeRecords: {}
        };
    }
    const todayDate = currentDateString();
    const now = new Date();
    const uniqueKey = todayDate + '_' + now.getHours().toString().padStart(2, '0') + now.getMinutes().toString().padStart(2, '0') + now.getSeconds().toString().padStart(2, '0');

    const newHistory = { ...storedData.completed };
    if (storedData.active.length > 0) {
        newHistory[uniqueKey] = [...storedData.active];
    }

    const newTimeHistory = { ...storedData.timeRecords };
    if (accumulatedTime > 0) {
        newTimeHistory[uniqueKey] = {
            time: accumulatedTime,
            formattedTime: convertTime(accumulatedTime)
        };
    }

    localStorage.setItem('tasks', JSON.stringify({
        active: [],
        completed: newHistory,
        timeRecords: newTimeHistory
    }));

    taskList.innerHTML = '';
    restartTimer();
    loadTasks();
    displayNotification('Success!', 'Tasks and timer archived successfully!');
}

function togglePastView() {
    const container = pastTasksContainer;
    const button = togglePastBtn;
    
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        button.classList.add('active');
    } else {
        container.classList.add('hidden');
        button.classList.remove('active');
    }
}

beginBtn.addEventListener('click', beginTimer);
haltBtn.addEventListener('click', haltTimer);
restartBtn.addEventListener('click', restartTimer);
storeBtn.addEventListener('click', storeCurrentTasks);
togglePastBtn.addEventListener('click', togglePastView);
addTaskBtn.addEventListener('click', (e) => {
    e.preventDefault();
    addNewTask();
});
taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addNewTask();
    }
});

window.addEventListener('load', () => {
    migrateLegacyStorage();
    loadTasks();
    loadTimerState();
    const savedTheme = localStorage.getItem('theme');
    const themeOptions = ['theme-sunrise', 'theme-green', 'theme-dark', 'theme-midnight', 'theme-rose', 'theme-mint', 'theme-lavender', 'theme-sunset', 'theme-ice'];
    document.body.classList.remove(...themeOptions);
    if (savedTheme) {
        if (savedTheme) document.body.classList.add(savedTheme);
    }
    setActiveThemeOption(savedTheme || '');
    updateCompletion();
});

haltBtn.disabled = true;

const themeSwitch = document.getElementById('themeToggle');
const themePanel = document.getElementById('themePanel');
const themeButtons = document.querySelectorAll('#themePanel .theme-option');
const allThemes = ['theme-sunrise', 'theme-green', 'theme-dark', 'theme-midnight', 'theme-rose', 'theme-mint', 'theme-lavender', 'theme-sunset', 'theme-ice'];

function setActiveThemeOption(themeValue) {
    themeButtons.forEach(btn => {
        const t = btn.getAttribute('data-theme') || '';
        if (t === (themeValue || '')) btn.classList.add('active');
        else btn.classList.remove('active');
    });
}

function openThemeSelector() {
    themePanel.setAttribute('aria-hidden', 'false');
    themePanel.classList.add('open');
}
function closeThemeSelector() {
    themePanel.setAttribute('aria-hidden', 'true');
    themePanel.classList.remove('open');
}

themeSwitch.addEventListener('click', (e) => {
    e.stopPropagation();
    const hiddenState = themePanel.getAttribute('aria-hidden') !== 'false';
    if (hiddenState) openThemeSelector(); else closeThemeSelector();
});

document.addEventListener('click', (e) => {
    if (!themePanel.contains(e.target) && e.target !== themeSwitch) {
        closeThemeSelector();
    }
});

themeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const themeValue = btn.getAttribute('data-theme');
        document.body.classList.remove(...allThemes);
        if (themeValue) document.body.classList.add(themeValue);
        if (themeValue) localStorage.setItem('theme', themeValue); else localStorage.removeItem('theme');
        setActiveThemeOption(themeValue || '');
        closeThemeSelector();
    });
});

function loadTimerState() {
    let storedData = JSON.parse(localStorage.getItem('tasks'));
    if (!storedData) {
        storedData = {
            active: [],
            completed: {},
            timeRecords: {}
        };
        localStorage.setItem('tasks', JSON.stringify(storedData));
    }
    const todayDate = currentDateString();
    
    if (storedData.timeRecords[todayDate]) {
        accumulatedTime = storedData.timeRecords[todayDate].time;
        timeDisplay.textContent = storedData.timeRecords[todayDate].formattedTime;
        updateTimeColor(timeDisplay, accumulatedTime);
    } else {
        updateTimeColor(timeDisplay, 0);
    }
}

function storeTimer() {
    let storedData = JSON.parse(localStorage.getItem('tasks'));
    if (!storedData) {
        storedData = {
            active: [],
            completed: {},
            timeRecords: {}
        };
    }
    const todayDate = currentDateString();
    
    if (accumulatedTime > 0) {
        storedData.timeRecords[todayDate] = {
            time: accumulatedTime,
            formattedTime: convertTime(accumulatedTime)
        };
        localStorage.setItem('tasks', JSON.stringify(storedData));
    }
}

window.addEventListener('beforeunload', () => {
    storeTimer();
});