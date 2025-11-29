import { useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

// Fix for default marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Create a custom icon for temporary marker (red)
const tempMarkerIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

const initialEvents = [
  {
    id: 1,
    title: 'Jazz Night at the Bridge',
    locationName: 'Tower Bridge',
    dateTime: '2024-03-15 19:00',
    description: 'An evening of smooth jazz performances overlooking the Thames. Featuring local artists and refreshments.',
    position: [51.5055, -0.0754]
  },
  {
    id: 2,
    title: 'Art Exhibition Opening',
    locationName: 'British Museum',
    dateTime: '2024-03-18 18:30',
    description: 'Contemporary art exhibition showcasing works from emerging London artists. Free entry with refreshments.',
    position: [51.5194, -0.1270]
  },
  {
    id: 3,
    title: 'Summer Music Festival',
    locationName: 'Hyde Park',
    dateTime: '2024-03-20 14:00',
    description: 'Outdoor music festival featuring multiple stages, food vendors, and activities for all ages.',
    position: [51.5074, -0.1657]
  },
  {
    id: 4,
    title: 'Tech Meetup',
    locationName: 'London Eye',
    dateTime: '2024-03-22 18:00',
    description: 'Monthly tech meetup for developers and entrepreneurs. Networking, talks, and discussions about the latest in tech.',
    position: [51.5033, -0.1195]
  },
  {
    id: 5,
    title: 'Street Performance Festival',
    locationName: 'Covent Garden',
    dateTime: '2024-03-25 12:00',
    description: 'Weekend street performance festival with musicians, magicians, and entertainers throughout the market area.',
    position: [51.5115, -0.1236]
  }
]

// Component to handle map clicks
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng)
    }
  })
  return null
}

function App() {
  const [events, setEvents] = useState(initialEvents)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    locationName: '',
    date: '',
    time: '',
    description: ''
  })

  const handleMapClick = (latlng) => {
    setSelectedPosition([latlng.lat, latlng.lng])
    setIsModalOpen(true)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (!selectedPosition) {
      return // Should not happen, but safety check
    }
    
    // Generate a new ID (use timestamp to ensure uniqueness)
    const newId = Date.now()
    
    // Combine date and time into dateTime string
    const dateTime = `${formData.date} ${formData.time}`
    
    const newEvent = {
      id: newId,
      title: formData.title,
      locationName: formData.locationName,
      dateTime: dateTime,
      description: formData.description,
      position: selectedPosition
    }
    
    // Add the new event to the events array
    setEvents(prevEvents => [...prevEvents, newEvent])
    
    // Reset form, clear selected position, and close modal
    setFormData({
      title: '',
      locationName: '',
      date: '',
      time: '',
      description: ''
    })
    setSelectedPosition(null)
    setIsModalOpen(false)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedPosition(null)
    setFormData({
      title: '',
      locationName: '',
      date: '',
      time: '',
      description: ''
    })
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Scene</h1>
      </header>
      <MapContainer
        center={[51.505, -0.09]}
        zoom={13}
        className="map-container"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onMapClick={handleMapClick} />
        {events.map((event) => (
          <Marker key={event.id} position={event.position}>
            <Popup>
              <div style={{ minWidth: '200px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold' }}>
                  {event.title}
                </h3>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#666' }}>
                  <strong>Location:</strong> {event.locationName}
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px', color: '#666' }}>
                  <strong>Date & Time:</strong> {event.dateTime}
                </p>
                <p style={{ margin: '8px 0 0 0', fontSize: '14px', lineHeight: '1.4' }}>
                  {event.description}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
        {selectedPosition && (
          <Marker 
            position={selectedPosition}
            icon={tempMarkerIcon}
          >
            <Popup>Selected location</Popup>
          </Marker>
        )}
      </MapContainer>

      {isModalOpen && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Event</h2>
              <button className="close-button" onClick={handleCloseModal}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="event-form">
              <div className="form-group">
                <label htmlFor="title">Event Title</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="locationName">Location Name</label>
                <input
                  type="text"
                  id="locationName"
                  name="locationName"
                  value={formData.locationName}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="date">Date</label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="time">Time</label>
                <input
                  type="time"
                  id="time"
                  name="time"
                  value={formData.time}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="4"
                  required
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={handleCloseModal} className="cancel-button">
                  Cancel
                </button>
                <button type="submit" className="submit-button">
                  Add Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

