const data = JSON.parse(localStorage.getItem('weatherBuddyData')) || {};
const apiKey = '***REMOVED***'; // having this exposed is a Bad Idea®

function renderWeatherData(current, fiveDay) {
  debugger;
}

async function fetchWeatherData(locationQuery) {
  const endPoints = {
    current: 'weather',
    fiveDay: 'forecast',
  };
  const apiUrl = `https://api.openweathermap.org/data/2.5/{endpoint}?${locationQuery}&appid=${apiKey}`;
  //let response = await fetch(apiUrl.replace('{endpoint}', endPoints.current));
  //data.testCurrent = await response.json();
  //response = await fetch(apiUrl.replace('{endpoint}', endPoints.fiveDay));
  //data.testFiveDay = await response.json();
  //localStorage.setItem('weatherBuddyData', JSON.stringify(data));
  renderWeatherData(data.testCurrent, data.testFiveDay);
}

function formSubmitHandler(event) {
  event.preventDefault();
  console.log(event);
  const input = event.target.querySelector('input[type=text]').value.trim().replace(/\s/g, ' ');
  const locationQuery = `q=${input}`;
  fetchWeatherData(locationQuery);
}
document.querySelector('#location').addEventListener('submit', formSubmitHandler);

if (navigator.geolocation) {
  const getLocationBtn = document.querySelector('#get-location');
  getLocationBtn.classList.remove('insivible');
  getLocationBtn.addEventListener('click', () => {
    navigator.geolocation.getCurrentPosition(() => {
      const locationQuery = `lat=${coords.latitude}&lon=${coords.longitude}`;
      fetchWeatherData(locationQuery);
    });
  });
}
