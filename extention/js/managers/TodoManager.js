// Todo Manager
// Handles todo list functionality with drag and drop

class TodoManager {
  constructor() {
    this.todos = [];
  }

  async loadTodos() {
    try {
      const data = await chrome.storage.local.get(['todos']);
      this.todos = data.todos || [];
      return this.todos;
    } catch (error) {
      console.error('Error loading todos:', error);
      return [];
    }
  }

  async saveTodos() {
    try {
      await chrome.storage.local.set({ todos: this.todos });
    } catch (error) {
      console.error('Error saving todos:', error);
    }
  }

  async addTodo(text) {
    if (!text.trim()) {
      showToastMessage('Please enter a task', 'error');
      return;
    }

    try {
      const todo = {
        id: Date.now().toString(),
        text: text.trim(),
        completed: false,
        createdAt: Date.now()
      };

      this.todos.unshift(todo);
      await this.saveTodos();
      this.render();
      showToastMessage('Task added', 'success');
    } catch (error) {
      console.error('Error adding todo:', error);
      showToastMessage('Failed to add task', 'error');
    }
  }

  async removeTodo(id) {
    try {
      this.todos = this.todos.filter(todo => todo.id !== id);
      await this.saveTodos();
      this.render();
    } catch (error) {
      console.error('Error removing todo:', error);
      showToastMessage('Failed to remove task', 'error');
    }
  }

  async toggleTodo(id) {
    try {
      const todo = this.todos.find(t => t.id === id);
      if (todo) {
        todo.completed = !todo.completed;
        await this.saveTodos();
        this.render();
      }
    } catch (error) {
      console.error('Error toggling todo:', error);
      showToastMessage('Failed to update task', 'error');
    }
  }

  async render() {
    const container = document.getElementById('todo-list');
    if (!container) return;

    await this.loadTodos();

    if (this.todos.length === 0) {
      container.innerHTML = '<div class="empty-state">No tasks yet. Add one to get started!</div>';
      return;
    }

    container.innerHTML = this.todos.map((todo, index) => `
      <div 
        class="todo-item ${todo.completed ? 'completed' : ''}" 
        draggable="true"
        data-id="${todo.id}"
        data-index="${index}"
      >
        <div class="todo-drag-handle" title="Drag to reorder">⋮⋮</div>
        <input 
          type="checkbox" 
          class="todo-checkbox" 
          ${todo.completed ? 'checked' : ''}
          data-id="${todo.id}"
        >
        <span class="todo-text">${escapeHtml(todo.text)}</span>
        <button class="todo-delete" data-id="${todo.id}" title="Delete">×</button>
      </div>
    `).join('');

    container.querySelectorAll('.todo-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        this.toggleTodo(e.target.dataset.id);
      });
    });

    container.querySelectorAll('.todo-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.removeTodo(e.target.dataset.id);
      });
    });

    this.setupDragAndDrop(container);
  }

  setupDragAndDrop(container) {
    let draggedElement = null;
    let draggedIndex = null;

    container.querySelectorAll('.todo-item').forEach((item) => {
      const checkbox = item.querySelector('.todo-checkbox');
      const deleteBtn = item.querySelector('.todo-delete');
      
      [checkbox, deleteBtn].forEach(el => {
        if (el) {
          el.addEventListener('mousedown', (e) => {
            e.stopPropagation();
          });
        }
      });

      item.addEventListener('dragstart', (e) => {
        draggedElement = item;
        draggedIndex = parseInt(item.dataset.index);
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        container.querySelectorAll('.todo-item').forEach(el => {
          el.classList.remove('drag-over');
        });
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (!draggedElement || draggedElement === item) return;
        
        container.querySelectorAll('.todo-item').forEach(el => {
          el.classList.remove('drag-over');
        });
        
        item.classList.add('drag-over');
      });

      item.addEventListener('drop', async (e) => {
        e.preventDefault();
        
        if (!draggedElement || draggedElement === item) {
          container.querySelectorAll('.todo-item').forEach(el => {
            el.classList.remove('drag-over');
          });
          return;
        }
        
        const allItems = Array.from(container.querySelectorAll('.todo-item:not(.dragging)'));
        const dropIndex = allItems.indexOf(item);
        
        const draggedTodo = this.todos[draggedIndex];
        this.todos.splice(draggedIndex, 1);
        
        let newIndex = dropIndex;
        if (draggedIndex < dropIndex) {
          newIndex = dropIndex;
        }
        
        this.todos.splice(newIndex, 0, draggedTodo);
        
        await this.saveTodos();
        this.render();
      });
    });
  }
}
