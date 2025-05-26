from langchain_huggingface import HuggingFaceEmbeddings
import numpy as np

# Initialize embeddings model
try:
    embeddings_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
except Exception as e:
    raise Exception(f"Failed to initialize embeddings model: {str(e)}")

def compute_relevance_score(job_description, cv_text):
    if not cv_text.strip() or not job_description.strip():
        print("Debug: Empty job description or CV text")
        return 0.0
    
    try:
        # Compute embeddings for job description and CV text
        job_embedding = np.array(embeddings_model.embed_query(job_description), dtype=np.float32)
        cv_embedding = np.array(embeddings_model.embed_query(cv_text), dtype=np.float32)
    except Exception as e:
        print(f"Debug: Error computing embeddings - {str(e)}")
        return 0.0
    
    # Normalize embeddings
    job_norm = np.linalg.norm(job_embedding)
    cv_norm = np.linalg.norm(cv_embedding)
    
    if job_norm == 0 or cv_norm == 0:
        print("Debug: Zero norm for embeddings")
        return 0.0
    
    job_embedding = job_embedding / job_norm
    cv_embedding = cv_embedding / cv_norm
    
    # Compute cosine similarity (dot product of normalized vectors)
    cosine_similarity = np.dot(job_embedding, cv_embedding)
    print(f"Debug: Cosine similarity = {cosine_similarity}")
    
    # Convert to a standard float to avoid serialization issues
    cosine_similarity = float(cosine_similarity)
    
    # Convert to a 0-100 scale (cosine similarity is between -1 and 1)
    relevance_score = (cosine_similarity + 1) * 50
    print(f"Debug: Computed relevance score = {relevance_score}")
    
    return max(0.0, min(100.0, float(relevance_score)))

def generate_feedback(job_description, cv, relevance_score):
    if not cv.get("extracted_text", "").strip():
        return "Unable to evaluate CV: No readable content found."

    structured_content = cv.get("structured_content", {})
    cv_skills = structured_content.get("skills", [])
    cv_experience = structured_content.get("experience", [])
    cv_text = cv.get("extracted_text", "")

    job_skills = job_description.get("skills", "").lower().split(", ")
    job_experience = job_description.get("experience", "").lower()

    # Clean up skills list by parsing raw strings
    cleaned_skills = []
    for skill_entry in cv_skills:
        if any(section in skill_entry.lower() for section in ["achievements", "positions of responsibility", "courses taken"]):
            break
        if "•" in skill_entry:
            skill_part = skill_entry.split("•")[-1].strip()
            skills = [s.strip().replace("*", "") for s in skill_part.replace(",", " ").split()]
            cleaned_skills.extend(skills)

    # Extract experience indicators
    if not cv_experience:
        cv_text_lower = cv_text.lower()
        potential_experience = ["years", "worked at", "internship", "engineer", "developer"]
        found_experience = any(exp in cv_text_lower for exp in potential_experience)
    else:
        found_experience = bool(cv_experience)

    # Compare skills
    matching_skills = [skill for skill in cleaned_skills if skill.lower() in [js.lower() for js in job_skills]]
    missing_skills = [js for js in job_skills if js.lower() not in [skill.lower() for skill in cleaned_skills]]

    # Compare experience (more flexible matching)
    experience_keywords = job_experience.split()
    cv_text_lower = cv_text.lower()
    experience_match = found_experience and any(keyword in cv_text_lower for keyword in experience_keywords)

    feedback = []
    if matching_skills:
        feedback.append(f"The CV demonstrates relevant skills like {', '.join(matching_skills)}, which align well with the job requirements.")
    if missing_skills:
        feedback.append(f"The CV lacks some required skills such as {', '.join(missing_skills)}.")
    if experience_match:
        feedback.append("The experience section matches the job's requirements.")
    else:
        feedback.append("The experience section does not fully meet the job's requirements; consider adding more relevant experience.")

    return " ".join(feedback) if feedback else "No specific feedback available."