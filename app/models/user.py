from pydantic import BaseModel

class User(BaseModel):
    username: str
    password: str
    role: str  # Options: "recruiter", "hiring_manager", "admin", "job_seeker"

class UserInDB(User):
    hashed_password: str