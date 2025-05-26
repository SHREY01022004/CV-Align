import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

function JobOpenings({ token, onLogout }) {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  // Decode token to get role
  const role = token ? JSON.parse(atob(token.split('.')[1])).role : '';

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const response = await axios.get('http://127.0.0.1:8000/api/job-descriptions', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setJobs(response.data);
      } catch (error) {
        setMessage('Error fetching job openings: ' + (error.response?.data?.detail || 'Unknown error'));
      }
    };
    fetchJobs();
  }, [token]);

  const handleViewDetails = (job) => {
    setSelectedJob(job);
  };

  const handleCloseDetails = () => {
    setSelectedJob(null);
    setFile(null);
    setMessage('');
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleApply = async (jobId) => {
  if (!file) {
    setMessage('Please select a file.');
    return;
  }
  if (jobId === undefined || jobId === null) {
    setMessage('Error: Job ID is missing.');
    return;
  }
  setIsSubmitting(true);
  const formData = new FormData();
  formData.append('file', file);
  formData.append('job_id', jobId);
  try {
    const response = await axios.post('http://127.0.0.1:8000/api/upload-cv', formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    });
    setMessage('Application submitted successfully! Cloud URL: ' + response.data.cloud_url);
    setFile(null);
    document.querySelector('input[type="file"]').value = null;
  } catch (error) {
    setMessage(error.response?.data?.detail || 'Error submitting application.');
  } finally {
    setIsSubmitting(false);
  }
};

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="App">
      <h1>Job Openings</h1>
      <nav className="nav">
        <Link to="/job-openings" className="nav-link">Job Openings</Link>
        {role === 'admin' && (
          <Link to="/dashboard" className="nav-link">Dashboard</Link>
        )}
        <button onClick={handleLogout} className="logout-button">Logout</button>
      </nav>

      {message && <p className="form-message">{message}</p>}

      {jobs.length === 0 ? (
        <p>No job openings available at the moment.</p>
      ) : (
        <table className="table">
          <thead className="table-head">
            <tr>
              <th>Job Title</th>
              <th>Posted By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => (
              <tr key={job.id} className="table-row">
                <td>{job.jobTitle}</td>
                <td>{job.created_by}</td>
                <td>
                  <button
                    onClick={() => handleViewDetails(job)}
                    className="table-button"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedJob && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-heading">{selectedJob.jobTitle}</h2>
            <p><strong>Posted By:</strong> {selectedJob.created_by}</p>
            <p><strong>Required Skills:</strong> {selectedJob.skills}</p>
            <p><strong>Preferred Experience:</strong> {selectedJob.experience}</p>
            <p><strong>Desired Traits:</strong> {selectedJob.traits || 'N/A'}</p>

            {role === 'job_seeker' && (
              <div className="modal-section">
                <h3 className="modal-subheading">Apply for this Job</h3>
                <form onSubmit={(e) => { e.preventDefault(); handleApply(selectedJob.id); }} className="form">
                  <div>
                    <label className="form-label">Upload CV (PDF or DOCX):</label>
                    <input
                      type="file"
                      accept=".pdf,.docx"
                      onChange={handleFileChange}
                      required
                      className="form-input"
                      disabled={isSubmitting}
                    />
                  </div>
                  <button type="submit" className="form-button" disabled={isSubmitting}>
                    {isSubmitting ? 'Applying...' : 'Apply'}
                  </button>
                </form>
              </div>
            )}

            <button
              onClick={handleCloseDetails}
              className="modal-close-button"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default JobOpenings;