const fs = require('fs');
let code = fs.readFileSync('frontend/src/components/ClientDataView.jsx', 'utf8');

const oldImageLogic = `        try {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64String = reader.result;
            const res = await updateProfilePicture(base64String);`;

const newImageLogic = `        try {
          const reader = new FileReader();
          reader.onloadend = () => {
            const img = new Image();
            img.onload = async () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 256;
              const MAX_HEIGHT = 256;
              let width = img.width;
              let height = img.height;

              if (width > height) {
                if (width > MAX_WIDTH) {
                  height *= MAX_WIDTH / width;
                  width = MAX_WIDTH;
                }
              } else {
                if (height > MAX_HEIGHT) {
                  width *= MAX_HEIGHT / height;
                  height = MAX_HEIGHT;
                }
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, width, height);
              
              const base64String = canvas.toDataURL('image/jpeg', 0.8);
              const res = await updateProfilePicture(base64String);`;

// Also need to adjust the closing brackets correctly
const oldImageLogicFull = `        try {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64String = reader.result;
            const res = await updateProfilePicture(base64String);
            
            if (!res.success) {
              setUploadError('Failed to save profile picture: ' + (res.error || 'Unknown error'));
            }
            
            setIsUploading(false);
            if (e.target) e.target.value = '';
          };
          reader.onerror = () => {
            setIsUploading(false);
            setUploadError('Failed to read image file.');
            if (e.target) e.target.value = '';
          };
          reader.readAsDataURL(file);
        } catch (err) {`;

const newImageLogicFull = `        try {
          const reader = new FileReader();
          reader.onloadend = () => {
            const img = new Image();
            img.onload = async () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 256;
              const MAX_HEIGHT = 256;
              let width = img.width;
              let height = img.height;

              if (width > height) {
                if (width > MAX_WIDTH) {
                  height *= MAX_WIDTH / width;
                  width = MAX_WIDTH;
                }
              } else {
                if (height > MAX_HEIGHT) {
                  width *= MAX_HEIGHT / height;
                  height = MAX_HEIGHT;
                }
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, width, height);
              
              // Compress to JPEG with 80% quality
              const base64String = canvas.toDataURL('image/jpeg', 0.8);
              
              const res = await updateProfilePicture(base64String);
              
              if (!res.success) {
                setUploadError('Failed to save profile picture: ' + (res.error || 'Unknown error'));
              }
              
              setIsUploading(false);
              if (e.target) e.target.value = '';
            };
            img.src = reader.result;
          };
          reader.onerror = () => {
            setIsUploading(false);
            setUploadError('Failed to read image file.');
            if (e.target) e.target.value = '';
          };
          reader.readAsDataURL(file);
        } catch (err) {`;

if (code.includes('const base64String = reader.result;')) {
    code = code.replace(oldImageLogicFull, newImageLogicFull);
    fs.writeFileSync('frontend/src/components/ClientDataView.jsx', code);
    console.log("Replaced with client-side canvas compression!");
} else {
    console.log("Could not find the target code string!");
}
