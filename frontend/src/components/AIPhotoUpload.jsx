import { useState, useCallback } from 'react';
import { Upload, X, Loader, CheckCircle, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { aiApi } from '../api';

export default function AIPhotoUpload({ onDataExtracted }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (JPEG, PNG, WebP).');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);

    // Analyse with AI
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await aiApi.analyzeImage(formData);
      onDataExtracted(data.data);
      toast.success(`Detected: ${data.data.foodName || 'Food item'}`, { icon: '🤖' });
    } catch (err) {
      const msg = err?.response?.data?.message || err.message;
      toast.error(`AI analysis failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [onDataExtracted]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onInputChange = (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  };

  const clear = () => {
    setPreview(null);
  };

  return (
    <div>
      {preview ? (
        <div style={{ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <img src={preview} alt="Food preview" style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} />
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)',
          }}>
            {loading ? (
              <div style={{ textAlign: 'center', color: 'white' }}>
                <div className="spinner" style={{ margin: '0 auto var(--space-2)' }} />
                <div style={{ fontSize: 'var(--font-size-sm)' }}>Analysing with AI…</div>
              </div>
            ) : (
              <CheckCircle size={32} color="var(--color-success)" />
            )}
          </div>
          {!loading && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={clear}
              style={{ position: 'absolute', top: 8, right: 8 }}
              id="btn-clear-photo"
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>
      ) : (
        <label
          className={`upload-zone ${dragging ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          id="zone-photo-upload"
          style={{ cursor: 'pointer' }}
        >
          <Camera size={32} color="var(--color-primary)" />
          <div>
            <div className="upload-zone-title">📸 AI Food Recognition</div>
            <div className="upload-zone-subtitle">Drop a photo or click to upload a food label / plate</div>
          </div>
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={onInputChange}
            id="input-photo-upload"
          />
          <span className="btn btn-secondary btn-sm">
            <Upload size={14} /> Choose Photo
          </span>
        </label>
      )}
    </div>
  );
}
