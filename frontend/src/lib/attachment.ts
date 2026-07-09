import { toast } from 'sonner';

export const handleViewAttachment = async (requestId: string) => {
  if (!requestId) {
    toast.error('Attachment not found.');
    return;
  }

  // To prevent the "about:blank" race condition when processing large base64 strings,
  // we first open a new tab immediately (as a synchronous reaction to the user click, preventing popup blockers).
  const newTab = window.open('', '_blank');
  
  if (!newTab) {
    toast.error('Popup blocked. Please allow popups for this site.');
    return;
  }

  // Show a loading message in the new tab
  newTab.document.write('<html><head><title>Loading Attachment...</title></head><body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;color:#666;"><h2>Loading attachment...</h2></body></html>');
  newTab.document.close();

  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'}/leave-requests/${requestId}/attachment`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 403) throw new Error('Forbidden');
      if (response.status === 404) throw new Error('Not Found');
      throw new Error('Server Error');
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    // Instead of redirecting the top frame to a blob URL (which Chrome sometimes blocks),
    // we use an iframe or embed tag that spans 100% of the screen.
    const isPdf = blob.type === 'application/pdf';
    
    let htmlContent = '';
    if (isPdf) {
      htmlContent = `
        <html>
          <head>
            <title>Medical Certificate</title>
            <style>body { margin: 0; overflow: hidden; background: #333; }</style>
          </head>
          <body>
            <embed src="${blobUrl}" type="application/pdf" width="100%" height="100%" style="border: none;" />
          </body>
        </html>
      `;
    } else {
      htmlContent = `
        <html>
          <head>
            <title>Medical Certificate</title>
            <style>body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #222; }</style>
          </head>
          <body>
            <img src="${blobUrl}" style="max-width: 100%; max-height: 100vh; object-fit: contain;" />
          </body>
        </html>
      `;
    }

    // Write the new content which loads the Blob URL
    newTab.document.open();
    newTab.document.write(htmlContent);
    newTab.document.close();

    // Revoke the blob URL when the new window is closed to free memory
    const checkClosed = setInterval(() => {
      if (newTab.closed) {
        URL.revokeObjectURL(blobUrl);
        clearInterval(checkClosed);
      }
    }, 1000);

  } catch (error: any) {
    console.error('Failed to parse attachment:', error);
    newTab.document.open();
    newTab.document.write('<html><body><h2>Unable to load attachment.</h2></body></html>');
    newTab.document.close();
    
    if (error.message === 'Forbidden') {
      toast.error("You don't have permission to view this attachment.");
    } else if (error.message === 'Not Found') {
      toast.error('Attachment not found.');
    } else {
      toast.error('Unable to load attachment.');
    }
  }
};
