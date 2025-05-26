from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os
from app.models.user import User, UserInDB
from app.utils.auth import hash_password, verify_password, create_access_token, decode_access_token
from app.utils.cloudinary_config import upload_file
from app.utils.rag_model import compute_relevance_score, generate_feedback
import PyPDF2
from docx import Document
import io

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")
USERS_FILE = "users.json"
JOB_FILE = "job_descriptions.json"
CV_FILE = "cvs.json"
EVALUATION_FILE = "evaluations.json"

class JobDescription(BaseModel):
    jobTitle: str
    skills: str
    experience: str
    traits: str | None

def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'r') as f:
            return json.load(f)
    return []

def save_users(users):
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f, indent=2)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    return decode_access_token(token)

def extract_text_from_pdf(file):
    pdf_reader = PyPDF2.PdfReader(file)
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text()
    return text

def extract_text_from_docx(file):
    doc = Document(file)
    text = ""
    for para in doc.paragraphs:
        text += para.text + "\n"
    return text

def structure_cv_content(text):
    sections = {"education": [], "experience": [], "skills": [], "positions_of_responsibility": []}
    lines = text.split('\n')
    current_section = None

    for line in lines:
        line = line.strip()
        if not line:
            continue
        line_lower = line.lower()
        if any(keyword in line_lower for keyword in ["education", "academic", "qualification"]):
            current_section = "education"
        elif any(keyword in line_lower for keyword in ["experience", "work history", "employment", "projects"]):
            current_section = "experience"
        elif any(keyword in line_lower for keyword in ["skills", "technical skills", "abilities", "competencies"]):
            current_section = "skills"
        elif any(keyword in line_lower for keyword in ["positions of responsibility"]):
            current_section = "positions_of_responsibility"
        elif any(keyword in line_lower for keyword in ["achievements", "courses taken"]):
            current_section = None
        elif current_section:
            sections[current_section].append(line)
        else:
            if any(keyword in line_lower for keyword in ["university", "degree", "b.tech", "m.tech", "phd"]):
                sections["education"].append(line)
            elif any(keyword in line_lower for keyword in ["years", "worked at", "internship", "engineer", "developer"]):
                sections["experience"].append(line)
            elif any(keyword in line_lower for keyword in ["python", "javascript", "java", "sql", "leadership", "teamwork"]):
                sections["skills"].append(line)

    return sections

@app.get("/")
async def root():
    return {"message": "CvAlign API is running!"}

@app.post("/register")
async def register(user: User):
    users = load_users()
    if any(u["username"] == user.username for u in users):
        raise HTTPException(status_code=400, detail="Username already exists")
    if user.role not in ["recruiter", "hiring_manager", "admin", "job_seeker"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    hashed_password = hash_password(user.password)
    user_data = {"username": user.username, "hashed_password": hashed_password, "role": user.role}
    users.append(user_data)
    save_users(users)
    return {"message": "User registered successfully"}

@app.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    users = load_users()
    user = next((u for u in users if u["username"] == form_data.username), None)
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access_token = create_access_token(data={"sub": user["username"], "role": user["role"]})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/job-descriptions")
async def get_job_descriptions(current_user: dict = Depends(get_current_user)):
    try:
        if not os.path.exists(JOB_FILE):
            return []
        with open(JOB_FILE, 'r') as f:
            jobs = json.load(f)
        if current_user["role"] in ["recruiter", "hiring_manager"]:
            jobs = [job for job in jobs if job.get("created_by") == current_user["username"]]
        return [{"id": idx, **job} for idx, job in enumerate(jobs)]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching job descriptions: {str(e)}")

@app.post("/api/job-description")
async def save_job_description(job: JobDescription, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["hiring_manager", "admin", "recruiter"]:
        raise HTTPException(status_code=403, detail="Not authorized to create job descriptions")
    try:
        if os.path.exists(JOB_FILE):
            with open(JOB_FILE, 'r') as f:
                jobs = json.load(f)
        else:
            jobs = []
        if current_user["role"] == "recruiter":
            existing_jobs = [j for j in jobs if j.get("created_by") == current_user["username"]]
            if existing_jobs:
                raise HTTPException(status_code=400, detail="Recruiters can only create one job description")
        job_data = job.dict()
        job_data["created_by"] = current_user["username"]
        jobs.append(job_data)
        with open(JOB_FILE, 'w') as f:
            json.dump(jobs, f, indent=2)
        return {"message": "Job description saved successfully"}
    except Exception as e:
        print(f"Error saving job description: {e}")
        return {"message": f"Error saving job description: {str(e)}"}

@app.post("/api/upload-cv")
async def upload_cv(file: UploadFile = File(...), job_id: str = Form(None), current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "job_seeker":
        raise HTTPException(status_code=403, detail="Only job seekers can upload CVs")
    try:
        # Convert job_id to integer if provided
        job_id_int = int(job_id) if job_id is not None else None
        job_title = None
        if job_id_int is not None:
            if not os.path.exists(JOB_FILE):
                raise HTTPException(status_code=404, detail="No job descriptions available")
            with open(JOB_FILE, 'r') as f:
                jobs = json.load(f)
            if job_id_int < 0 or job_id_int >= len(jobs):
                raise HTTPException(status_code=400, detail="Invalid job ID")
            job_title = jobs[job_id_int]["jobTitle"]

        file_path = f"temp_{file.filename}"
        with open(file_path, "wb") as f:
            f.write(await file.read())
        cloud_url = upload_file(file_path)
        if file.filename.endswith(".pdf"):
            with open(file_path, "rb") as f:
                text = extract_text_from_pdf(f)
        elif file.filename.endswith(".docx"):
            text = extract_text_from_docx(file_path)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Use PDF or DOCX.")
        
        # Validate extracted text
        if not text.strip():
            os.remove(file_path)
            raise HTTPException(status_code=400, detail="Unable to extract text from CV. Please upload a CV with selectable text (not scanned or image-based).")

        structured_content = structure_cv_content(text)
        if os.path.exists(CV_FILE):
            with open(CV_FILE, 'r') as f:
                cvs = json.load(f)
        else:
            cvs = []
        cv_data = {
            "username": current_user["username"],
            "filename": file.filename,
            "cloud_url": cloud_url,
            "extracted_text": text,
            "structured_content": structured_content,
            "job_id": job_id_int,
            "job_title": job_title
        }
        cvs.append(cv_data)
        with open(CV_FILE, 'w') as f:
            json.dump(cvs, f, indent=2)
        os.remove(file_path)
        return {"message": "CV uploaded and processed successfully", "cloud_url": cloud_url}
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job_id format; must be an integer")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing CV: {str(e)}")

class EvaluateCVRequest(BaseModel):
    username: str
    job_id: int

@app.post("/api/evaluate-cv")
async def evaluate_cv(request: EvaluateCVRequest, current_user: dict = Depends(get_current_user)):
    print(f"Received evaluation request: username={request.username}, job_id={request.job_id}, user={current_user}")
    if current_user["role"] not in ["recruiter", "admin"]:
        raise HTTPException(status_code=403, detail="Only recruiters and admins can evaluate CVs")
    try:
        if request.job_id is None:
            raise HTTPException(status_code=400, detail="Job ID is required")
        if not os.path.exists(JOB_FILE):
            raise HTTPException(status_code=404, detail="No job descriptions found")
        if not os.path.exists(CV_FILE):
            raise HTTPException(status_code=404, detail="No CVs found")
        with open(JOB_FILE, 'r') as f:
            jobs = json.load(f)
        with open(CV_FILE, 'r') as f:
            cvs = json.load(f)

        print(f"Found {len(jobs)} jobs and {len(cvs)} CVs")

        if current_user["role"] == "recruiter":
            recruiter_jobs = [job for job in jobs if job.get("created_by") == current_user["username"]]
            print(f"Recruiter jobs: {recruiter_jobs}")
            if request.job_id < 0 or request.job_id >= len(jobs) or jobs[request.job_id] not in recruiter_jobs:
                raise HTTPException(status_code=403, detail="You can only evaluate CVs for your own job descriptions")

        cv = next((cv for cv in cvs if cv["username"] == request.username and cv.get("job_id") == request.job_id), None)
        if not cv:
            print(f"CV not found for username={request.username}, job_id={request.job_id}")
            raise HTTPException(status_code=404, detail="CV not found for this job description")

        print(f"Found CV: {cv}")

        cv["structured_content"] = structure_cv_content(cv["extracted_text"])
        with open(CV_FILE, 'w') as f:
            json.dump(cvs, f, indent=2)

        job = jobs[request.job_id]
        job_text = f"{job['jobTitle']} requires skills: {job['skills']}, experience: {job['experience']}, traits: {job['traits'] or 'N/A'}"
        cv_text = cv["extracted_text"]
        if not cv_text.strip():
            raise HTTPException(status_code=400, detail="CV text is empty")

        print(f"Job text: {job_text}")
        print(f"CV text: {cv_text}")

        relevance_score = compute_relevance_score(job_text, cv_text)
        feedback = generate_feedback(job, cv, relevance_score)
        evaluation = {
            "username": cv["username"],
            "filename": cv["filename"],
            "relevance_score": relevance_score,
            "feedback": feedback,
            "job_title": job["jobTitle"],
            "job_id": request.job_id
        }

        print(f"Evaluation result: {evaluation}")

        existing_evaluations = []
        if os.path.exists(EVALUATION_FILE):
            with open(EVALUATION_FILE, 'r') as f:
                existing_evaluations = json.load(f)
        existing_evaluations = [eval for eval in existing_evaluations if not (eval["username"] == request.username and eval["job_id"] == request.job_id)]
        existing_evaluations.append(evaluation)

        with open(EVALUATION_FILE, 'w') as f:
            json.dump(existing_evaluations, f, indent=2)

        return {"message": "CV evaluated successfully", "evaluation": evaluation}
    except Exception as e:
        print(f"Evaluation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error evaluating CV: {str(e)}")
    
@app.get("/api/cvs")
async def get_cvs(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["recruiter", "admin"]:
        raise HTTPException(status_code=403, detail="Only recruiters and admins can view CVs")
    try:
        if not os.path.exists(CV_FILE):
            return []
        with open(CV_FILE, 'r') as f:
            cvs = json.load(f)
        if current_user["role"] == "recruiter":
            if not os.path.exists(JOB_FILE):
                return []
            with open(JOB_FILE, 'r') as f:
                jobs = json.load(f)
            recruiter_job_ids = [idx for idx, job in enumerate(jobs) if job.get("created_by") == current_user["username"]]
            filtered_cvs = []
            for cv in cvs:
                if "job_id" not in cv:
                    continue
                job_id = cv["job_id"]
                if isinstance(job_id, int) and job_id in recruiter_job_ids:
                    filtered_cvs.append(cv)
                    continue
                if isinstance(job_id, str):
                    try:
                        job_id_int = int(job_id)
                        if job_id_int in recruiter_job_ids:
                            filtered_cvs.append(cv)
                    except ValueError:
                        continue
        else:
            filtered_cvs = cvs
        return filtered_cvs
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching CVs: {str(e)}")

@app.get("/api/evaluations")
async def get_evaluations(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["recruiter", "admin"]:
        raise HTTPException(status_code=403, detail="Only recruiters and admins can view evaluations")
    try:
        if not os.path.exists(EVALUATION_FILE):
            return []
        with open(EVALUATION_FILE, 'r') as f:
            evaluations = json.load(f)
        if current_user["role"] == "recruiter":
            if not os.path.exists(JOB_FILE):
                return []
            with open(JOB_FILE, 'r') as f:
                jobs = json.load(f)
            recruiter_job_ids = [idx for idx, job in enumerate(jobs) if job.get("created_by") == current_user["username"]]
            evaluations = [eval for eval in evaluations if eval.get("job_id") in recruiter_job_ids]
        return evaluations
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching evaluations: {str(e)}")