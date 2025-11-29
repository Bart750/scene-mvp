import { useState, useEffect, useCallback } from 'react'
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
    description: '',
    category: ''
  })
  const [selectedCategory, setSelectedCategory] = useState('All Categories')
  
  const categories = ['Music', 'Sports', 'Art', 'Food', 'Nightlife', 'Community', 'Other']
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [interestedData, setInterestedData] = useState({}) // { eventId: { count: number, userInterested: boolean } }
  const [checkinData, setCheckinData] = useState({}) // { eventId: { userCheckedIn: boolean } }
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [checkinHistory, setCheckinHistory] = useState([]) // Array of { event, checkin } objects
  
  // Initialize date range: From = today, To = 7 days from now
  const getTodayString = () => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }
  
  const getSevenDaysFromNowString = () => {
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
    return sevenDaysFromNow.toISOString().split('T')[0]
  }
  
  const [dateRange, setDateRange] = useState({
    from: getTodayString(),
    to: getSevenDaysFromNowString()
  })

  // Check for existing session and listen for auth changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

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
          position: [event.lat, event.lng],
          category: event.category || 'Other'
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

  // Fetch interested data when events or user changes
  useEffect(() => {
    const fetchInterestedData = async () => {
      if (events.length === 0) return

      try {
        const eventIds = events.map(e => e.id)
        
        // Fetch all interested records for these events
        const { data: interestedRecords, error } = await supabase
          .from('interested')
          .select('event_id, user_id')
          .in('event_id', eventIds)

        if (error) {
          console.error('Error fetching interested data:', error)
          return
        }

        // Calculate counts and user interest status
        const interestedMap = {}
        eventIds.forEach(eventId => {
          const records = interestedRecords?.filter(r => r.event_id === eventId) || []
          interestedMap[eventId] = {
            count: records.length,
            userInterested: user ? records.some(r => r.user_id === user.id) : false
          }
        })

        setInterestedData(interestedMap)
      } catch (error) {
        console.error('Error fetching interested data:', error)
      }
    }

    fetchInterestedData()
  }, [events, user])

  // Fetch check-in data when events or user changes
  useEffect(() => {
    const fetchCheckinData = async () => {
      if (events.length === 0 || !user) {
        setCheckinData({})
        return
      }

      try {
        const eventIds = events.map(e => e.id)
        
        // Fetch all check-in records for these events for the current user
        const { data: checkinRecords, error } = await supabase
          .from('checkins')
          .select('event_id')
          .in('event_id', eventIds)
          .eq('user_id', user.id)

        if (error) {
          console.error('Error fetching check-in data:', error)
          return
        }

        // Create map of events user has checked into
        const checkinMap = {}
        eventIds.forEach(eventId => {
          checkinMap[eventId] = {
            userCheckedIn: checkinRecords?.some(r => r.event_id === eventId) || false
          }
        })

        setCheckinData(checkinMap)
      } catch (error) {
        console.error('Error fetching check-in data:', error)
      }
    }

    fetchCheckinData()
  }, [events, user])

  const handleMapClick = (latlng) => {
    // Require login to add events
    if (!user) {
      alert('Please sign in to add events.')
      return
    }
    setSelectedPosition([latlng.lat, latlng.lng])
    setIsModalOpen(true)
  }

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    })
    if (error) {
      console.error('Error signing in:', error)
      alert('Failed to sign in. Please try again.')
    }
  }

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error signing out:', error)
      alert('Failed to sign out. Please try again.')
    }
  }

  // Calculate distance between two GPS coordinates using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180
    const φ2 = lat2 * Math.PI / 180
    const Δφ = (lat2 - lat1) * Math.PI / 180
    const Δλ = (lon2 - lon1) * Math.PI / 180

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c // Distance in meters
  }

  // Get user's current GPS location
  const getUserLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'))
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        (error) => {
          reject(error)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )
    })
  }

  const handleToggleInterest = async (eventId) => {
    if (!user) {
      handleSignIn()
      return
    }

    const currentData = interestedData[eventId] || { count: 0, userInterested: false }
    const isInterested = currentData.userInterested

    try {
      if (isInterested) {
        // Remove interest
        const { error } = await supabase
          .from('interested')
          .delete()
          .eq('event_id', eventId)
          .eq('user_id', user.id)

        if (error) throw error

        // Update local state
        setInterestedData(prev => ({
          ...prev,
          [eventId]: {
            count: Math.max(0, (prev[eventId]?.count || 0) - 1),
            userInterested: false
          }
        }))
      } else {
        // Add interest
        const { error } = await supabase
          .from('interested')
          .insert([
            {
              event_id: eventId,
              user_id: user.id
            }
          ])

        if (error) throw error

        // Update local state
        setInterestedData(prev => ({
          ...prev,
          [eventId]: {
            count: (prev[eventId]?.count || 0) + 1,
            userInterested: true
          }
        }))
      }
    } catch (error) {
      console.error('Error toggling interest:', error)
      alert('Failed to update interest. Please try again.')
    }
  }

  const handleCheckIn = async (eventId, eventPosition) => {
    if (!user) {
      handleSignIn()
      return
    }

    // Check if already checked in
    const currentCheckin = checkinData[eventId]
    if (currentCheckin?.userCheckedIn) {
      return // Already checked in
    }

    try {
      // Get user's current location
      const userLocation = await getUserLocation()
      
      // Calculate distance between user and event
      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        eventPosition[0],
        eventPosition[1]
      )

      // Check if within 100 meters
      if (distance > 100) {
        alert("You're too far from this event to check in")
        return
      }

      // Save check-in to database
      const { error } = await supabase
        .from('checkins')
        .insert([
          {
            event_id: eventId,
            user_id: user.id
          }
        ])

      if (error) throw error

      // Update local state
      setCheckinData(prev => ({
        ...prev,
        [eventId]: {
          userCheckedIn: true
        }
      }))

      // Refresh history if it's open
      if (isHistoryOpen) {
        fetchCheckinHistory()
      }
    } catch (error) {
      console.error('Error checking in:', error)
      if (error.message === 'Geolocation is not supported by your browser') {
        alert('Geolocation is not supported by your browser')
      } else if (error.code === 1) {
        alert('Location access denied. Please enable location permissions to check in.')
      } else if (error.code === 2) {
        alert('Location unavailable. Please try again.')
      } else if (error.code === 3) {
        alert('Location request timed out. Please try again.')
      } else {
        alert('Failed to check in. Please try again.')
      }
    }
  }

  // Fetch check-in history with event details
  const fetchCheckinHistory = useCallback(async () => {
    if (!user) {
      setCheckinHistory([])
      return
    }

    try {
      const { data: checkins, error } = await supabase
        .from('checkins')
        .select(`
          id,
          created_at,
          event_id,
          events (
            id,
            title,
            category,
            date_time
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching check-in history:', error)
        return
      }

      // Transform data to include event details
      const history = checkins.map(checkin => ({
        checkinId: checkin.id,
        checkinDate: checkin.created_at,
        event: checkin.events
      })).filter(item => item.event !== null) // Filter out any null events

      setCheckinHistory(history)
    } catch (error) {
      console.error('Error fetching check-in history:', error)
    }
  }, [user])

  // Fetch history when modal opens
  useEffect(() => {
    if (isHistoryOpen && user) {
      fetchCheckinHistory()
    }
  }, [isHistoryOpen, user, fetchCheckinHistory])

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
    
    // Insert event into Supabase with user_id and category
    const { data, error } = await supabase
      .from('events')
      .insert([
        {
          title: formData.title,
          location_name: formData.locationName,
          date_time: dateTime,
          description: formData.description,
          lat: selectedPosition[0],
          lng: selectedPosition[1],
          user_id: user?.id,
          category: formData.category || 'Other'
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
        position: [data[0].lat, data[0].lng],
        category: data[0].category || 'Other'
      }
      
      setEvents(prevEvents => [...prevEvents, newEvent])
    }
    
    setFormData({
      title: '',
      locationName: '',
      date: '',
      time: '',
      description: '',
      category: ''
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
      description: '',
      category: ''
    })
  }

  const handleDateRangeChange = (e) => {
    const { name, value } = e.target
    setDateRange(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleCategoryFilterChange = (e) => {
    setSelectedCategory(e.target.value)
  }

  // Filter events based on date range, category, and exclude past events
  const getFilteredEvents = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const fromDate = new Date(dateRange.from)
    fromDate.setHours(0, 0, 0, 0)
    
    const toDate = new Date(dateRange.to)
    toDate.setHours(23, 59, 59, 999)
    
    return events.filter(event => {
      // Parse event dateTime (format: "YYYY-MM-DD HH:mm")
      const eventDateStr = event.dateTime.split(' ')[0]
      const eventDate = new Date(eventDateStr)
      eventDate.setHours(0, 0, 0, 0)
      
      // Exclude past events (before today)
      if (eventDate < today) {
        return false
      }
      
      // Check if event is within date range
      if (eventDate < fromDate || eventDate > toDate) {
        return false
      }
      
      // Check category filter
      if (selectedCategory !== 'All Categories' && event.category !== selectedCategory) {
        return false
      }
      
      return true
    })
  }

  // Get category color for styling
  const getCategoryColor = (category) => {
    const colors = {
      'Music': '#8b5cf6',
      'Sports': '#10b981',
      'Art': '#f59e0b',
      'Food': '#ef4444',
      'Nightlife': '#6366f1',
      'Community': '#06b6d4',
      'Other': '#6b7280'
    }
    return colors[category] || colors['Other']
  }

  const filteredEvents = getFilteredEvents()

  return (
    <div className="app">
      <header className="app-header">
        <img src={sceneLogo} alt="Scene" className="logo" />
        <div className="auth-section">
          {user ? (
            <div className="user-info">
              {user.user_metadata?.avatar_url && (
                <img 
                  src={user.user_metadata.avatar_url} 
                  alt={user.user_metadata?.full_name || user.email} 
                  className="user-avatar"
                />
              )}
              <span className="user-name">
                {user.user_metadata?.full_name || user.email?.split('@')[0]}
              </span>
              <button onClick={() => setIsHistoryOpen(true)} className="history-button">
                My History
              </button>
              <button onClick={handleSignOut} className="sign-out-button">
                Sign Out
              </button>
            </div>
          ) : (
            <button onClick={handleSignIn} className="sign-in-button">
              Sign In
            </button>
          )}
        </div>
      </header>
      <div className="date-range-filter">
        <div className="date-range-inputs">
          <div className="date-input-group">
            <label htmlFor="fromDate">From</label>
            <input
              type="date"
              id="fromDate"
              name="from"
              value={dateRange.from}
              onChange={handleDateRangeChange}
            />
          </div>
          <div className="date-input-group">
            <label htmlFor="toDate">To</label>
            <input
              type="date"
              id="toDate"
              name="to"
              value={dateRange.to}
              onChange={handleDateRangeChange}
              min={dateRange.from}
            />
          </div>
          <div className="date-input-group">
            <label htmlFor="categoryFilter">Category</label>
            <select
              id="categoryFilter"
              value={selectedCategory}
              onChange={handleCategoryFilterChange}
              className="category-filter-select"
            >
              <option value="All Categories">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
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
        {filteredEvents.map((event) => {
          const interestInfo = interestedData[event.id] || { count: 0, userInterested: false }
          const checkinInfo = checkinData[event.id] || { userCheckedIn: false }
          return (
            <Marker key={event.id} position={event.position}>
              <Popup>
                <div className="event-popup">
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold' }}>
                    {event.title}
                  </h3>
                  {event.category && (
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>
                      <strong>Category:</strong> {event.category}
                    </p>
                  )}
                  <p style={{ margin: '4px 0', fontSize: '14px', color: '#666' }}>
                    <strong>Location:</strong> {event.locationName}
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '14px', color: '#666' }}>
                    <strong>Date & Time:</strong> {event.dateTime}
                  </p>
                  <p style={{ margin: '8px 0 12px 0', fontSize: '14px', lineHeight: '1.4' }}>
                    {event.description}
                  </p>
                  <div className="event-interest-section">
                    {interestInfo.count > 0 && (
                      <span className="interest-count">
                        {interestInfo.count} {interestInfo.count === 1 ? 'person' : 'people'} interested
                      </span>
                    )}
                    {user ? (
                      <button
                        onClick={() => handleToggleInterest(event.id)}
                        className={`interest-button ${interestInfo.userInterested ? 'interested' : ''}`}
                      >
                        {interestInfo.userInterested ? "You're interested ✓" : "I'm interested"}
                      </button>
                    ) : (
                      <button
                        onClick={handleSignIn}
                        className="interest-button sign-in-prompt"
                      >
                        Sign in to show interest
                      </button>
                    )}
                  </div>
                  {user && (
                    <div className="event-checkin-section">
                      {checkinInfo.userCheckedIn ? (
                        <div className="checkin-status">
                          You checked in ✓
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCheckIn(event.id, event.position)}
                          className="checkin-button"
                        >
                          Check In
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })}
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
              <div className="form-group">
                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                  className="category-select"
                >
                  <option value="">Select a category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
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

      {isHistoryOpen && (
        <div className="modal-overlay" onClick={() => setIsHistoryOpen(false)}>
          <div className="modal-content history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>My Check-In History</h2>
              <button className="close-button" onClick={() => setIsHistoryOpen(false)}>×</button>
            </div>
            <div className="history-content">
              {checkinHistory.length === 0 ? (
                <div className="empty-history">
                  <p>You haven't checked into any events yet.</p>
                  <p className="empty-history-subtitle">Check in to events to see them here!</p>
                </div>
              ) : (
                <div className="history-list">
                  {checkinHistory.map((item) => {
                    const checkinDate = new Date(item.checkinDate)
                    const eventDate = new Date(item.event.date_time)
                    
                    return (
                      <div key={item.checkinId} className="history-item">
                        <div className="history-item-header">
                          <h3 className="history-event-title">{item.event.title}</h3>
                          {item.event.category && (
                            <span 
                              className="history-category-tag"
                              style={{ backgroundColor: getCategoryColor(item.event.category) }}
                            >
                              {item.event.category}
                            </span>
                          )}
                        </div>
                        <div className="history-item-details">
                          <p className="history-event-date">
                            <strong>Event Date:</strong> {eventDate.toLocaleDateString('en-US', { 
                              weekday: 'short', 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          <p className="history-checkin-date">
                            <strong>Checked In:</strong> {checkinDate.toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="history-actions">
                <button 
                  onClick={() => setIsHistoryOpen(false)} 
                  className="back-to-map-button"
                >
                  Back to Map
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

