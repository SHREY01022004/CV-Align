import cloudinary
import cloudinary.uploader
import os

# Configure Cloudinary with credentials from environment variables
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME", "dij6ju01j"),
    api_key=os.getenv("CLOUDINARY_API_KEY", "516763539886773"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET", "vGLex0RB22x2kpttHGhPVW9cR7A"),
    secure=True
)

def upload_file(file_path):
    try:
        response = cloudinary.uploader.upload(
            file_path,
            resource_type="raw",  # For non-image files like PDF/DOCX
            folder="cv_uploads"   # Store CVs in a folder named "cv_uploads"
        )
        return response["secure_url"]
    except Exception as e:
        raise Exception(f"Error uploading to Cloudinary: {str(e)}")