import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'
import sceneLogo from './assets/scene-logo.png'
import { supabase } from './supabase'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const tempMarkerIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})


function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => onMapClick(e.latlng)
  })
  return null
}

function App() {
  const [events, setEvents] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    locationName: '',
    date: '',
    time: '',
    description: ''
  })
  const [isLoading, setIsLoading] = useState(true)

  // Fetch events from Supabase on component mount
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error fetching events:', error)
          return
        }

        // Transform database events to app format
        const transformedEvents = data.map(event => ({
          id: event.id,
          title: event.title,
          locationName: event.location_name,
          dateTime: event.date_time,
          description: event.description,
          position: [event.lat, event.lng]
        }))

        setEvents(transformedEvents)
      } catch (error) {
        console.error('Error fetching events:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchEvents()
  }, [])

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!selectedPosition) return
    
    const dateTime = `${formData.date} ${formData.time}`
    
    // Insert event into Supabase
    const { data, error } = await supabase
      .from('events')
      .insert([
        {
          title: formData.title,
          location_name: formData.locationName,
          date_time: dateTime,
          description: formData.description,
          lat: selectedPosition[0],
          lng: selectedPosition[1]
        }
      ])
      .select()

    if (error) {
      console.error('Error inserting event:', error)
      alert('Failed to add event. Please try again.')
      return
    }

    // Transform the inserted event to app format and add to state
    if (data && data.length > 0) {
      const newEvent = {
        id: data[0].id,
        title: data[0].title,
        locationName: data[0].location_name,
        dateTime: data[0].date_time,
        description: data[0].description,
        position: [data[0].lat, data[0].lng]
      }
      
      setEvents(prevEvents => [...prevEvents, newEvent])
    }
    
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
        <img src={sceneLogo} alt="Scene" className="logo" />
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

