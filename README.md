# What is `client-zip` ?

`client-zip` concatenates multiple files into a single ZIP, **in the browser**, so you can let your users save several files in one click. It does *not* compress the files or unzip existing archives.

See the [original repository](https://github.com/Touffy/client-zip) for more information about this library.

I am using this library because I wanted a lightweight way to save multiple images from IndexedDB as image files in a zip file and this lets me stream to disk without having them all in memory at the same time. I made my own fork because the main page opens from a file:// url so I can't do modern imports. Since I went to the effort of repackage it as UMD, I figured I should let others see what I did.

# Building
Install node. Any version 18 or newer should work.
```sh
node -v
(verify that node 18 or newer is installed)
git clone https://github.com/vatavian/client-zip-browser.git
cd client-zip-browser
npm install
npm run build:browser
```
This will create dist/client-zip.browser.js. Put that file near your .html and add it as a script:
```html
<script type="text/javascript" src="client-zip.browser.js"></script>
```

Now you can use it in your Javascript without an import. 

# Example: Save image blobs from IndexedDB in a zip file:
The code below first tries to use clientZip.makeZip if showSaveFilePicker works to get a stream. Not all browsers support that, so the code falls back to using clientZip.downloadZip with the older strategy of making a temporary anchor and triggering its click event to download. The streaming version has a very low memory footprint. The fallback needs the whole zip file in memory before saving, but at least it does not also keep all the source blobs because each one is garbage collectable after it is added through downloadZip.

```javascript
class saveZip {
    static MIME_TO_EXT = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
        "image/gif": "gif",
        "image/bmp": "bmp",
        "image/svg+xml": "svg" };
    static extensionFromBlob(blob) { return this.MIME_TO_EXT[blob.type] ?? "png" }

    // Feed one image blob file at a time into clientZip
    static async* _imageFilesForZip(names) {
        for (const name of names) {
            const imageRec = await db.getImageFromDatabase(name);
            if (imageRec?.imageData instanceof Blob) // imageData is the field in db containing image blob
                yield { // Only one blob at a time is in use. When creating this filename, sanitize it!!!
                    name: name + '.' + this.extensionFromBlob(imageRec.imageData),
                    input: imageRec.imageData
                };
            else console.warn(`Not a blob, not zipping: ${name}`);
        }
    }

    // Save all images stored as blob in indexedDB as a zip file.
    static async savePortraitsAsZip() {
        const namesWithImages = await db.getAllKeys();
        const suggestFilename = 'images.zip';

        if ('showSaveFilePicker' in window) try {
            // Use File System Access API to stream and avoid building whole zip in memory
            const handle = await showSaveFilePicker({
                suggestedName: suggestFilename,
                types: [{ accept: { "application/zip": [".zip"] } }]
            });
            const writable = await handle.createWritable();
            const zipStream = clientZip.makeZip(this._imageFilesForZip(namesWithImages));
            await zipStream.pipeTo(writable);
            console.log(`Wrote file: ${handle.name}`);
            return;
        } catch (err) {
            console.Error(`Error writing: ${err}`);
        }
        try { // Fallback if the File System Access API is not supported or did not work
            const blob = await clientZip.downloadZip(this._imageFilesForZip(namesWithImages)).blob();
            const blobURL = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobURL;
            a.download = suggestFilename;
            a.style.display = 'none';
            document.body.append(a);
            a.click(); // Programmatically click to trigger download
            setTimeout(() => { // Clean up later
                URL.revokeObjectURL(blobURL);
                a.remove();
            }, 10000);
            console.log(`Saved file: ${suggestFilename}`);
        } catch (err) {
            console.error(`Error writing: ${err}`);
        }
    }
}

class db { // An example of getting data from IndexedDB, skip if this is not your use case
    static imageDB = null;
    static async initImageDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('myImageDBname', 1);
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject("Make sure there are no other open copies of this page and reload.");
            request.onsuccess = () => {
                db.imageDB = request.result;
                const transaction = imageDB.transaction('images', 'readonly');
                const store = transaction.objectStore('images');
                db.imageDB.onversionchange = function () {
                    db.imageDB.close();
                    alert("Database is outdated, please reload the page.")
                };
                resolve(db.imageDB);
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('images')) {
                    let imageStore = db.createObjectStore('images', { keyPath: 'name' });
                }
            };
        });
    }

    static async getAllKeys() {
      if (!db.imageDB) await db.initImageDatabase();
      return new Promise((resolve, reject) => {
          const transaction = db.imageDB.transaction('images', 'readonly');
          const store = transaction.objectStore('images');
          const getAllRequest = store.getAllKeys();
          getAllRequest.onsuccess = (e) => resolve(e.target.result);
      });
    }

    static async getImageFromDatabase(name) {
        try {
            if (!name) return null;
            if (!db.imageDB) await db.initImageDatabase();

            return new Promise((resolve, reject) => {
                const transaction = db.imageDB.transaction('images', 'readonly');
                const store = transaction.objectStore('images');

                const getRequest = store.get(name);
                getRequest.onerror = () => reject(getRequest.error);
                getRequest.onsuccess = () => {
                    const record = getRequest.result;
                    if (!record) {
                        resolve(null);
                        return;
                    }
                    resolve(record);
                };
            });
        } catch (error) {
            console.error('Error in getImageFromDatabase:', error);
            return null;
        }
    }
}
```
I am not planning to continue to develop this fork, but I welcome suggestions and PRs. The example code above is based on working code but it was also modified and simplified in the process and has not been tested as-is.