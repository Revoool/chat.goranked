# Components Structure

This directory contains all React components organized by feature/module.

## Structure

```
components/
├── common/              # Reusable UI components used across the app
│   ├── IconButton.tsx
│   ├── EmojiPicker.tsx
│   └── TypingIndicator.tsx
│
├── layout/              # Layout components (Sidebar, Header, etc.)
│   └── Sidebar.tsx
│
├── chat/                # Chat-related components
│   ├── ChatList.tsx
│   ├── ChatListItem.tsx
│   ├── ChatWindow.tsx
│   ├── MessageList.tsx
│   ├── MessageItem.tsx
│   ├── MessageInput.tsx
│   ├── QuickReplies.tsx
│   └── modals/          # Chat modals
│       ├── AssignModal.tsx
│       ├── NoteModal.tsx
│       ├── PriorityModal.tsx
│       ├── StatusModal.tsx
│       ├── TagsModal.tsx
│       └── ClientOrdersModal.tsx
│
├── client/              # Client-related components
│   └── ClientCard.tsx
│
├── tasks/               # Task management components
│   ├── TasksList.tsx
│   ├── TaskRow.tsx
│   ├── TaskDialog.tsx
│   ├── TaskFilters.tsx
│   ├── KanbanBoard.tsx
│   ├── KanbanColumn.tsx
│   └── KanbanCard.tsx
│
└── settings/            # Settings components
    └── Settings.tsx
```

## Import Guidelines

### Direct imports (recommended)
```typescript
import ChatList from '../components/chat/ChatList';
import TaskDialog from '../components/tasks/TaskDialog';
import Sidebar from '../components/layout/Sidebar';
```

### Barrel imports (for convenience)
```typescript
import { ChatList, TaskDialog, Sidebar } from '../components';
```

## Component Organization Rules

1. **Feature-based grouping**: Components are grouped by feature/domain (chat, tasks, etc.)
2. **Common components**: Shared UI components go in `common/`
3. **Layout components**: App-wide layout components go in `layout/`
4. **Modals**: Feature-specific modals go in `{feature}/modals/`
5. **One component per file**: Each component has its own file
6. **Index files**: Each directory has an `index.ts` for convenient exports

## Adding New Components

1. Place the component in the appropriate directory based on its feature
2. Create/update the `index.ts` file in that directory
3. Update the main `components/index.ts` if needed
4. Follow the existing naming conventions (PascalCase for components)

## Styles

Each component should import its styles from `../../styles/{ComponentName}.css` (relative to component location).

