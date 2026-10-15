import api from './client'

export const login = (username: string, password: string) => {
  const form = new FormData()
  form.append('username', username)
  form.append('password', password)
  return api.post('/api/auth/token', form)
}

// Receptionist
export const searchPatients = (q?: string) => api.get('/api/receptionist/patients', { params: { q } })
export const registerPatient = (data: any) => api.post('/api/receptionist/patients', data)
export const getPatient = (id: number) => api.get(`/api/receptionist/patients/${id}`)
export const listDoctors = () => api.get('/api/receptionist/doctors')
export const createVisit = (data: any) => api.post('/api/receptionist/visits', data)
export const checkinVisit = (id: number) => api.post(`/api/receptionist/visits/${id}/checkin`)
export const todayVisits = () => api.get('/api/receptionist/visits')

// Nurse
export const nurseQueue = () => api.get('/api/nurse/queue')
export const recordVitals = (visitId: number, data: any) => api.post(`/api/nurse/vitals/${visitId}`, data)

// Doctor
export const doctorDashboard = () => api.get('/api/doctor/dashboard')
export const getDoctorPatient = (id: number) => api.get(`/api/doctor/patients/${id}`)
export const patientVisits = (id: number) => api.get(`/api/doctor/patients/${id}/visits`)
export const currentVisit = (id: number) => api.get(`/api/doctor/patients/${id}/current-visit`)
export const saveConsultation = (visitId: number, data: any) => api.post(`/api/doctor/visits/${visitId}/consultation`, data)
export const getConsultation = (visitId: number) => api.get(`/api/doctor/visits/${visitId}/consultation`)
export const savePrescriptions = (visitId: number, data: any) => api.post(`/api/doctor/visits/${visitId}/prescriptions`, data)
export const getPrescriptions = (visitId: number) => api.get(`/api/doctor/visits/${visitId}/prescriptions`)
export const getCatalogue = () => api.get('/api/doctor/catalogue')
export const createLabOrder = (data: any) => api.post('/api/doctor/lab-orders', data)
export const getVisitLabOrders = (visitId: number) => api.get(`/api/doctor/visits/${visitId}/lab-orders`)
export const getPatientReports = (patientId: number) => api.get(`/api/doctor/patients/${patientId}/reports`)
export const completeVisit = (visitId: number) => api.post(`/api/doctor/visits/${visitId}/complete`)

// Coordinator
export const coordDashboard = () => api.get('/api/coordinator/dashboard')
export const coordOrders = () => api.get('/api/coordinator/orders')
export const coordTechnicians = () => api.get('/api/coordinator/technicians')
export const coordPathologists = () => api.get('/api/coordinator/pathologists')
export const assignTechnician = (data: any) => api.post('/api/coordinator/assign-technician', data)
export const assignReviewer = (data: any) => api.post('/api/coordinator/assign-reviewer', data)
export const pendingReviews = () => api.get('/api/coordinator/pending-reviews')

// Technician
export const myOrders = () => api.get('/api/technician/my-orders')
export const collectSample = (data: any) => api.post('/api/technician/collect-sample', data)
export const receiveSample = (id: number) => api.post(`/api/technician/receive-sample/${id}`)
export const acceptSample = (id: number) => api.post(`/api/technician/accept-sample/${id}`)
export const rejectSample = (data: any) => api.post('/api/technician/reject-sample', data)
export const getSampleResults = (sampleId: number) => api.get(`/api/technician/results/${sampleId}`)
export const requestRerun = (resultId: number) => api.post(`/api/technician/request-rerun/${resultId}`)

// Pathologist
export const reviewQueue = () => api.get('/api/pathologist/review-queue')
export const resultContext = (resultId: number) => api.get(`/api/pathologist/result/${resultId}/context`)
export const submitReview = (assignmentId: number, data: any) => api.post(`/api/pathologist/review/${assignmentId}`, data)
export const myReports = () => api.get('/api/pathologist/my-reports')

export const cancelAppointment = (id: number) => api.post(`/api/receptionist/visits/${id}/cancel`)
export const rescheduleAppointment = (id: number, data: any) => api.post(`/api/receptionist/visits/${id}/reschedule`, data)
export const patientLabOrders = (id: number) => api.get(`/api/doctor/patients/${id}/lab-orders`)
export const sampleLabel = (id: number) => api.get(`/api/technician/samples/${id}/label`, { responseType: 'blob' })

export const doctorPatients = () => api.get('/api/doctor/patients')
