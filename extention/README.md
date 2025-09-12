# Hilidea Chrome Extension

A Chrome extension that allows users to highlight text on any webpage and save it to generate ideas via API, with Gmail authentication.

## Features

- 🔐 Gmail OAuth authentication
- ✨ Text highlighting on any webpage
- 💡 Context menu for saving highlighted text
- 🚀 API integration with mockapi.com/save
- 📱 Beautiful popup interface
- 💾 Local storage for user data

## Setup Instructions

### 1. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" and create an OAuth 2.0 Client ID
5. Set the application type to "Chrome extension"
6. Add your extension ID (you'll get this after loading the extension)
7. Copy the Client ID and replace `YOUR_GOOGLE_CLIENT_ID` in `manifest.json`

### 2. Install the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the extension folder
4. The extension should now appear in your extensions list

### 3. Usage

1. Click the extension icon to open the popup
2. Login with your Gmail account
3. Navigate to any webpage
4. Highlight any text
5. Click "Save & Generate Ideas" from the context menu
6. View the generated ideas

## File Structure

```
extention/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for auth and API calls
├── content.js            # Content script for text highlighting
├── content.css           # Styles for content script UI
├── popup.html            # Extension popup HTML
├── popup.css             # Popup styles
├── popup.js              # Popup functionality
├── icons/                # Extension icons (16px, 48px, 128px)
└── README.md             # This file
```

## API Integration

The extension calls `https://mockapi.com/save` with the following payload:

```json
{
  "text": "highlighted text",
  "url": "current page URL",
  "title": "page title",
  "user": {
    "email": "user@gmail.com",
    "name": "User Name"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Expected response:
```json
{
  "ideas": [
    "Idea 1",
    "Idea 2",
    "Idea 3"
  ]
}
```

## Development

To modify the extension:

1. Make changes to the relevant files
2. Go to `chrome://extensions/`
3. Click the refresh button on the extension card
4. Test your changes

## Permissions

- `identity`: For Gmail OAuth authentication
- `storage`: For storing user data locally
- `contextMenus`: For right-click context menu
- `activeTab`: For accessing current tab content
- `scripting`: For injecting content scripts
- `host_permissions`: For API calls and OAuth

## Troubleshooting

1. **Login not working**: Make sure you've set up the Google OAuth client ID correctly
2. **API calls failing**: Check that mockapi.com is accessible and the endpoint exists
3. **Context menu not appearing**: Ensure the extension has the necessary permissions
4. **Icons not showing**: Add icon files (16px, 48px, 128px) to the icons/ folder

## License

MIT License
