import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

const Dashboard = ({ token, onLogout }) => {
  const [evaluations, setEvaluations] = useState([]);
  const [cvs, setCvs] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  // Decode token to get role
  const role = token ? JSON.parse(atob(token.split('.')[1])).role : '';

  const fetchEvaluations = async () => {
    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };
      const response = await axios.get('http://127.0.0.1:8000/api/evaluations', config);
      setEvaluations(response.data);
    } catch (error) {
      console.error('Error fetching evaluations:', error);
      setMessage(error.response?.data?.detail || 'Error fetching evaluations.');
    }
  };

  const fetchCvs = async () => {
    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };
      const response = await axios.get('http://127.0.0.1:8000/api/cvs', config);
      setCvs(response.data);
    } catch (error) {
      console.error('Error fetching CVs:', error);
      setMessage(error.response?.data?.detail || 'Error fetching CVs.');
    }
  };

  useEffect(() => {
    fetchCvs();
    fetchEvaluations();
  }, [token]);

  const getCvDetails = (username, job_id) => {
    return cvs.find(cv => cv.username === username && cv.job_id === job_id) || {};
  };

  const getEvaluation = (username, job_id) => {
    return evaluations.find(evaluation => evaluation.username === username && evaluation.job_id === job_id) || null;
  };

  const handleEvaluateCv = async (username, job_id) => {
  try {
    // Validate inputs
    if (!username) {
      setMessage('Cannot evaluate CV: Username is missing.');
      return;
    }
    if (job_id === null || job_id === undefined) {
      setMessage('Cannot evaluate CV: Job ID is missing.');
      return;
    }
    console.log('Evaluating CV with:', { username, job_id });
    const config = {
      headers: { Authorization: `Bearer ${token}` }
    };
    const response = await axios.post('http://127.0.0.1:8000/api/evaluate-cv', { username, job_id }, config);
    console.log('Evaluation response:', response.data);
    setMessage(response.data.message || 'CV evaluated successfully!');
    await fetchEvaluations();
  } catch (error) {
    console.error('Evaluation error:', error.response?.data);
    let errorMessage = 'Error evaluating CV.';
    if (error.response?.data?.detail) {
      if (typeof error.response.data.detail === 'string') {
        errorMessage = error.response.data.detail;
      } else {
        errorMessage = error.response.data.detail.msg || JSON.stringify(error.response.data.detail);
      }
    }
    setMessage(errorMessage);
  }
};
  const openModal = (candidate) => {
    setSelectedCandidate(candidate);
  };

  const closeModal = () => {
    setSelectedCandidate(null);
  };

  const getSkills = (structuredContent) => {
    const cvSkills = structuredContent.skills || [];
    const cleanedSkills = [];
    for (const skillEntry of cvSkills) {
      if (["achievements", "positions of responsibility", "courses taken"].some(section => skillEntry.toLowerCase().includes(section))) {
        break;
      }
      if (skillEntry.includes("•")) {
        const skillPart = skillEntry.split("•").slice(-1)[0].trim();
        const skills = skillPart.replace(",", " ").split().map(s => s.trim().replace("*", ""));
        cleanedSkills.push(...skills);
      }
    }
    return cleanedSkills;
  };

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="App">
      <h1>CvAlign: Candidate Dashboard</h1>
      <nav className="nav">
        <Link to="/job-description" className="nav-link">Job Description</Link>
        <Link to="/dashboard" className="nav-link">Dashboard</Link>
        {role === 'admin' && (
          <Link to="/job-openings" className="nav-link">Job Openings</Link>
        )}
        <button onClick={handleLogout} className="logout-button">Logout</button>
      </nav>

      {message && <p className="form-message">{message}</p>}

      {cvs.length === 0 ? (
        <p>No candidates have applied to your job description yet.</p>
      ) : (
        <table className="table">
          <thead className="table-head">
            <tr>
              <th>Username</th>
              <th>CV Filename</th>
              <th>Job Role</th>
              <th>Relevance Score</th>
              <th>Feedback</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cvs.map((cv) => {
              const evaluation = getEvaluation(cv.username, cv.job_id);
              return (
                <tr key={`${cv.username}-${cv.job_id}`} className="table-row">
                  <td>{cv.username}</td>
                  <td>
                    <a href={cv.cloud_url} target="_blank" rel="noopener noreferrer" className="modal-link">
                      {cv.filename}
                    </a>
                  </td>
                  <td>{cv.job_title || 'Not specified'}</td>
                  <td>{evaluation ? evaluation.relevance_score.toFixed(2) : 'Not evaluated'}</td>
                  <td>{evaluation ? evaluation.feedback : 'Not evaluated'}</td>
                  <td>
                    {!evaluation ? (
                      <button
                        onClick={() => handleEvaluateCv(cv.username, cv.job_id)}
                        className="table-button"
                      >
                        Evaluate
                      </button>
                    ) : (
                      <button
                        onClick={() => openModal(evaluation)}
                        className="table-button"
                      >
                        View Details
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {selectedCandidate && (() => {
        const cv = getCvDetails(selectedCandidate.username, selectedCandidate.job_id);
        const structuredContent = cv.structured_content || {};
        const jobSkills = ["leadership", "agile"];
        const cvSkills = getSkills(structuredContent);
        const matchingSkills = cvSkills.filter(skill => jobSkills.includes(skill.toLowerCase()));
        const missingSkills = jobSkills.filter(skill => !cvSkills.some(cvSkill => cvSkill.toLowerCase() === skill.toLowerCase()));

        return (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2 className="modal-heading">{selectedCandidate.username} - CV Details</h2>
              <p><strong>Job Role:</strong> {selectedCandidate.job_title || 'Not specified'}</p>
              <p><strong>Relevance Score:</strong> {selectedCandidate.relevance_score.toFixed(2)}</p>
              <p><strong>Feedback:</strong> {selectedCandidate.feedback}</p>

              <div className="modal-section">
                <h3 className="modal-subheading">Detailed Feedback</h3>
                <p><strong>Matching Skills:</strong> {matchingSkills.length > 0 ? matchingSkills.join(", ") : "None"}</p>
                <p><strong>Missing Skills:</strong> {missingSkills.length > 0 ? missingSkills.join(", ") : "None"}</p>
                <p><strong>Experience Summary:</strong> {structuredContent.experience?.length > 0 ? `${structuredContent.experience.length} entries found, including internships and projects.` : "No experience entries found."}</p>
              </div>

              <div className="modal-section">
                <h3 className="modal-subheading">CV Breakdown</h3>
                <div className="modal-section">
                  <h4 className="modal-subheading">Skills:</h4>
                  <ul className="modal-list">
                    {(structuredContent.skills || []).map((skill, index) => (
                      <li key={index}>{skill}</li>
                    ))}
                  </ul>
                </div>
                <div className="modal-section">
                  <h4 className="modal-subheading">Experience:</h4>
                  <ul className="modal-list">
                    {(structuredContent.experience || []).map((exp, index) => (
                      <li key={index}>{exp}</li>
                    ))}
                  </ul>
                </div>
                <div className="modal-section">
                  <h4 className="modal-subheading">Education:</h4>
                  <ul className="modal-list">
                    {(structuredContent.education || []).map((edu, index) => (
                      <li key={index}>{edu}</li>
                    ))}
                  </ul>
                </div>
                {structuredContent.positions_of_responsibility && (
                  <div className="modal-section">
                    <h4 className="modal-subheading">Positions of Responsibility:</h4>
                    <ul className="modal-list">
                      {(structuredContent.positions_of_responsibility || []).map((pos, index) => (
                        <li key={index}>{pos}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {cv.cloud_url && (
                  <div className="modal-section">
                    <h4 className="modal-subheading">CV Link:</h4>
                    <a href={cv.cloud_url} target="_blank" rel="noopener noreferrer" className="modal-link">
                      View CV
                    </a>
                  </div>
                )}
              </div>

              <button
                onClick={closeModal}
                className="modal-close-button"
              >
                Close
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Dashboard;