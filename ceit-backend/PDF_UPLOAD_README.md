# PDF Document Upload Feature

## Overview
The admin dashboard (calendar.html) now supports PDF and image document uploads for authenticated admin users. This feature allows admins to post documents with captions that will be displayed in the public viewer feed alongside regular announcements.

## Features

### For Admin Users (calendar.html)
1. **Documents & Posts Tab** - New tab in the admin dashboard to manage documents
2. **Upload Form** - Interface to upload PDF files or images with captions
3. **Posts Management** - View and delete your department's posts
4. **Integrated Dashboard** - Everything in one place: events and documents

### For All Users (viewer.html)
1. **View PDF/Image Posts** - Documents appear in the feed with appropriate icons
2. **Download/View** - Click "View PDF" or view images inline
3. **Same Feed** - All types of content appear together in chronological order
4. **No Login Required** - Public viewing access

## How to Use

### Admin - Uploading a Document

1. **Login** - Go to `login.html` and sign in with admin credentials
2. **Access Admin Dashboard** - You'll be redirected to the admin dashboard (calendar.html by default, or viewer.html if specified)
3. **Navigate to Documents Tab** - Click "📄 Documents & Posts" tab at the top
4. **Fill Upload Form**:
   - Enter a caption/description for the document
   - Click "Choose PDF or Image File" to select a file from your computer
   - Click "📤 Upload Document" to post
5. **View Result** - Your document will appear in the posts list below
6. **Manage Posts** - View all your department's posts and delete if needed

### Viewing Documents in Public Feed

Document posts appear in the viewer.html feed with:
- 📄 PDF icon for PDFs or image preview for images
- File name for PDFs
- Caption/description from admin
- "View PDF" button for PDFs, inline display for images
- Admin name and department
- Timestamp

## Technical Details

### Admin Page (calendar.html)
- Tab-based interface: Events Calendar | Documents & Posts
- Upload form with file input (accepts .pdf and images)
- Posts list showing department's posts
- Delete functionality for managing posts
- Authentication via JWT token

### Viewer Page (viewer.html)
- Public viewing only (no upload capability)
- Displays all posts from all departments
- Enhanced post rendering for PDF vs image detection
- No authentication required

### Backend
- Uses existing `posts` table structure
- File URLs stored in `imageUrl` field
- POST `/posts` - Create new post (authenticated)
- GET `/posts/public` - Get all posts (public)
- GET `/posts` - Get department posts (authenticated)
- DELETE `/posts/:id` - Delete post (authenticated)

### Database Schema
```typescript
posts {
  id: uuid
  departmentId: uuid (FK)
  adminId: uuid (FK)
  caption: text
  imageUrl: text  // Used for both image URLs and PDF URLs
  createdAt: timestamp
}
```

## File Structure

- **calendar.html** - Admin dashboard with Events and Documents tabs (upload here)
- **viewer.html** - Public viewing page (view only)
- **login.html** - Authentication page
- **register.html** - Admin registration page

## Future Enhancements

Potential improvements:
1. **File Upload Service** - Integrate with AWS S3, Cloudinary, or similar for actual file hosting
2. **PDF Preview** - Show thumbnail or first page preview in feed
3. **File Size Validation** - Add max file size limits
4. **Multiple Files** - Support uploading multiple PDFs at once
5. **File Type Badge** - Add visual indicators for different file types
6. **Search/Filter** - Filter posts by content type (PDF, image, text-only)

## Notes

- Currently uses mock PDF URLs (demo purposes)
- Production deployment requires integration with a file storage service
- Only authenticated admins can upload documents
- All users (authenticated or not) can view the documents
- PDF files must be under browser/server limits
