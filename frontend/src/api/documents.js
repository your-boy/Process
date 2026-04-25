import request from '../utils/request'

export const flowchartAPI = {
  list: () => request.get('/flowcharts'),
  get: (id) => request.get(`/flowcharts/${id}`),
  create: (data) => request.post('/flowcharts', data),
  update: (id, data) => request.put(`/flowcharts/${id}`, data),
  delete: (id) => request.delete(`/flowcharts/${id}`)
}

export const mindmapAPI = {
  list: () => request.get('/mindmaps'),
  get: (id) => request.get(`/mindmaps/${id}`),
  create: (data) => request.post('/mindmaps', data),
  update: (id, data) => request.put(`/mindmaps/${id}`, data),
  delete: (id) => request.delete(`/mindmaps/${id}`)
}

export const markdownAPI = {
  list: () => request.get('/markdowns'),
  get: (id) => request.get(`/markdowns/${id}`),
  create: (data) => request.post('/markdowns', data),
  update: (id, data) => request.put(`/markdowns/${id}`, data),
  delete: (id) => request.delete(`/markdowns/${id}`)
}

export const notesAPI = {
  list: () => request.get('/notes'),
  get: (id) => request.get(`/notes/${id}`),
  create: (data) => request.post('/notes', data),
  update: (id, data) => request.put(`/notes/${id}`, data),
  delete: (id) => request.delete(`/notes/${id}`)
}
