// Data Manager
// Handles data export and import functionality

class DataManager {
  async exportData() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'exportData' });
      if (response.success && response.data) {
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `smarttab-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToastMessage('Data exported successfully', 'success');
        return true;
      }
      throw new Error('Export failed');
    } catch (error) {
      console.error('Error exporting data:', error);
      showToastMessage('Failed to export data', 'error');
      return false;
    }
  }

  async importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          
          if (!data.version || !data.data) {
            throw new Error('Invalid backup file format');
          }

          if (!confirm('This will replace all your current data. Are you sure?')) {
            resolve(false);
            return;
          }

          const response = await chrome.runtime.sendMessage({
            action: 'importData',
            data: data
          });

          if (response.success) {
            showToastMessage('Data imported successfully! Refreshing...', 'success');
            setTimeout(() => window.location.reload(), 1500);
            resolve(true);
          } else {
            throw new Error('Import failed');
          }
        } catch (error) {
          console.error('Error importing data:', error);
          showToastMessage('Failed to import data: ' + error.message, 'error');
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
}
