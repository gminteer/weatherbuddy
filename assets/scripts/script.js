/* global moment */
import {el, mount, setChildren} from 'https://redom.js.org/redom.es.min.js';
const data = JSON.parse(localStorage.getItem('weatherBuddyData')) || {lastReq: {}, previousSearches: []};
// The API supports metric or imperial units, but the user gets to choose metric or imperial so might as well just
// accept their default units (kelvin and meters/sec)
const kelvinToFahrenheit = (tempK) => ((tempK - 273.15) * 9) / 5 + 32;
// const kelvinToCelsius = (tempK) => tempK - 273.15;
const metricSpeedToMph = (metric) => metric * 2.237;
const currentContainer = document.querySelector('#current-weather-container');
const fiveDayContainer = document.querySelector('#five-day-container');
const previousSeachesContainer = document.querySelector('#previous-searches-container');
function renderFiveDay(dailyWeather) {
  const containerEl = el('div');
  for (let i = 0; i < 5; i++) {
    const day = dailyWeather[i];
    const cardEl = el('div');
    const titleEl = el('h3', moment.unix(day.dt).format('MM/DD hh:mma'));
    const cardIcon = el(`i.wi.wi-owm-${day.weather[0].id}.med-icon`);
    const weatherDetails = el('ul');
    const temperature = el('li', `Temperature: ${kelvinToFahrenheit(day.temp.day).toFixed(2)}°F`);
    const humidity = el('li', `Humidity: ${day.humidity}%`);
    setChildren(weatherDetails, [temperature, humidity]);
    setChildren(cardEl, [titleEl, cardIcon, weatherDetails]);
    mount(containerEl, cardEl);
  }
  setChildren(fiveDayContainer, containerEl);
}
function renderWeatherData(locationName, weatherData) {
  const current = weatherData.current;
  const cardEl = el('div');
  const titleEl = el('h2', `${locationName} - ${moment.unix(current.dt).format('MMM DD, hh:mma')}`);
  const cardIcon = el(`i.wi.wi-owm-${current.weather[0].id}.big-icon`);
  const weatherDetails = el('ul');
  let currentCondition;
  if (current.weather.length > 1)
    currentCondition = el('li', `${current.weather[0].main} then ${current.weather[1].main}`);
  else currentCondition = el('li', `${current.weather[0].main}`);
  const temperature = el(
    'li',
    `Temperature: ${kelvinToFahrenheit(current.temp).toFixed(2)}°F (feels like ${kelvinToFahrenheit(
      current.feels_like
    ).toFixed(2)})`
  );
  const humidity = el('li', `Humidity: ${current.humidity}%`);
  const wind = el('li', [
    `Wind Speed: ${metricSpeedToMph(current.wind_speed).toFixed(2)} MPH    `,
    el(`i.wi.wi-wind.from-${current.wind_deg}`, {style: {'font-size': '1.5rem'}}),
  ]);
  const uvIndex = el('li', 'UV Index: ', el('span', current.uvi));
  setChildren(weatherDetails, [currentCondition, temperature, humidity, wind, uvIndex]);
  setChildren(cardEl, [titleEl, cardIcon, weatherDetails]);

  setChildren(currentContainer, cardEl);
  renderFiveDay(weatherData.daily);
}

function renderPreviousSearches() {
  const searchContainer = el('ul.collection');
  for (const search of data.previousSearches) {
    const searchEl = el('li.collection-item', search);
    mount(searchContainer, searchEl);
  }
  setChildren(previousSeachesContainer, searchContainer);
}

async function fetchGeolocation(search) {
  let searchString;
  if (search.lat) searchString = `${search.lat},${search.lon}`;
  else searchString = search;
  const geolocationApiUrl = `https://geocode.xyz/${searchString}?json=1`;
  const response = await fetch(geolocationApiUrl);
  if (!response.ok) {
    console.error(`"${searchString}" resulted in server response ${response.status}: ${response.statusText}`);
    return;
  } else {
    if (response.status === 403)
      // the public endpoint will reject with 403 if it gets too busy
      setTimeout(fetchGeolocation(search), 1000 * Math.ceil(Math.random() * 5));
  }
  const data = await response.json();
  const out = {lat: data.latt, lon: data.longt};
  // reverse geolocating has a different output
  if (search.lat) out.name = data.city;
  else out.name = data.standard.city;
  return out;
}

async function fetchWeatherData(location) {
  if (data.lastReq[location.name]) {
    // don't hit the API for the same location more than once every 15 minutes
    const lastReq = data.lastReq[location.name];
    const timeStamp = moment(lastReq.timeStamp);
    if (moment.duration(moment().diff(timeStamp)).asMinutes() <= 15)
      return renderWeatherData(lastReq.location.name, lastReq.weatherData);
  }
  const locationQuery = `lat=${location.lat}&lon=${location.lon}`;
  const weatherApiUrl = `https://api.openweathermap.org/data/2.5/onecall?${locationQuery}&appid=${API_KEY}`;
  const reqData = {
    timeStamp: moment(),
  };
  const response = await fetch(weatherApiUrl);
  if (!response.ok) {
    console.error(`"${locationQuery}" resulted in ${response.status}: ${response.statusText}`);
    return;
  }
  reqData.location = location;
  reqData.weatherData = await response.json();
  data.lastReq[location.name] = reqData;
  if (!data.previousSearches.includes(location.name)) {
    data.previousSearches.push(location.name);
    if (data.previousSearches.length > 12) data.previousSearches.shift();
  }
  localStorage.setItem('weatherBuddyData', JSON.stringify(data));
  renderWeatherData(reqData.location.name, reqData.weatherData);
  renderPreviousSearches();
}

async function formSubmitHandler(event) {
  const inputEl = event.target.querySelector('input[type=search]');
  event.preventDefault();
  const input = inputEl.value.trim().replace(/\s/g, ' ');
  inputEl.value = '';
  const location = await fetchGeolocation(input);
  if (location) fetchWeatherData(location);
}
document.querySelector('#location').addEventListener('submit', formSubmitHandler);

if (navigator.geolocation) {
  const getLocationBtn = document.querySelector('#get-location');
  getLocationBtn.classList.remove('hide');
  getLocationBtn.addEventListener('click', () => {
    navigator.geolocation.getCurrentPosition(({coords}) => {
      fetchGeolocation({lat: coords.latitude, lon: coords.longitude}).then((location) => fetchWeatherData(location));
    });
  });
}
if (data.previousSearches.length > 0) {
  previousSeachesContainer.classList.remove('hide');
  renderPreviousSearches();
  previousSeachesContainer.addEventListener('click', (event) => {
    if (data.lastReq[event.target.textContent]) fetchWeatherData(data.lastReq[event.target.textContent].location);
  });
}
