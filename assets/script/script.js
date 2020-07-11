/* global moment */
import {el, mount, setChildren} from 'https://redom.js.org/redom.es.min.js';

const data = JSON.parse(localStorage.getItem('weatherBuddyData')) || {lastReq: {}, previousSearches: []};
const saveData = () => localStorage.setItem('weatherBuddyData', JSON.stringify(data));

// The API supports metric or imperial units, but the user gets to choose metric or imperial so might as well just
// accept their default units (kelvin and meters/sec)
const kelvinToFahrenheit = (tempK) => ((tempK - 273.15) * 9) / 5 + 32;
// const kelvinToCelsius = (tempK) => tempK - 273.15;
const metricSpeedToMph = (metric) => metric * 2.237;

const currentContainer = document.querySelector('#current-weather-container');
const fiveDayContainer = document.querySelector('#five-day-container');
const previousSeachesContainer = document.querySelector('#previous-searches-container');
const apiKeyContainer = document.querySelector('#api-key-container');
const apiKeyBtn = document.querySelector('#change-api-key');
const apiKeyPrompt = document.querySelector('#api-key-prompt');
const apiFormCancel = document.querySelector('#api-form-cancel');
const apiKeyForm = document.querySelector('#api-key-form');

function renderWeatherCardBody(bodyData) {
  const bodyEl = el('.card-body');
  const labelColEl = el('.card-body.label-col');
  const valueColEl = el('.card-body.value-col');
  for (const label of Object.keys(bodyData)) {
    const labelEl = el('h4', `${label}:`);
    mount(labelColEl, labelEl);
    const valueEl = el('span', bodyData[label]);
    mount(valueColEl, valueEl);
  }
  setChildren(bodyEl, [labelColEl, valueColEl]);
  return bodyEl;
}
function renderWeatherCard(headerEl, iconEl, bodyEl) {
  const cardEl = el('.card');
  const titleEl = el('.card-title');
  setChildren(titleEl, headerEl);
  setChildren(cardEl, [titleEl, iconEl, bodyEl]);
  return cardEl;
}
function renderFiveDay(dailyWeather) {
  const containerEl = el('.card-row');
  for (let i = 1; i < 6; i++) {
    const day = dailyWeather[i];
    // skipping the first day because it's today's weather
    const headerEl = el('h3', moment.unix(day.dt).format('MM/DD'));
    const iconEl = el(`i.wi.wi-owm-${day.weather[0].id}.med-icon`);
    const bodyData = {
      Temperature: `${kelvinToFahrenheit(day.temp.day).toFixed(2)}°F`,
      Humidity: `${day.humidity}%`,
    };
    const bodyEl = renderWeatherCardBody(bodyData);
    mount(containerEl, renderWeatherCard(headerEl, iconEl, bodyEl));
  }
  setChildren(fiveDayContainer, containerEl);
}

function renderWeatherData(locationName, weatherData) {
  const current = weatherData.current;
  const headerEl = [el('h2', locationName), el('h3', moment.unix(current.dt).format('MMM DD, hh:mma'))];
  const iconEl = el(`i.wi.wi-owm-${current.weather[0].id}.big-icon`);
  const bodyData = {
    Temperature: `${kelvinToFahrenheit(current.temp).toFixed(2)}°F (feels like ${kelvinToFahrenheit(
      current.feels_like
    ).toFixed(0)}°F)`,
    Humidity: `${current.humidity}%`,
    'Wind Speed': [
      `${metricSpeedToMph(current.wind_speed).toFixed(2)} MPH`,
      el(`i.wi.wi-wind.from-${current.wind_deg}.wind-icon`),
    ],
    'UV Index': el('span#uv-index', current.uvi),
  };
  const bodyEl = renderWeatherCardBody(bodyData);
  const uvIndex = bodyEl.querySelector('#uv-index');
  const uvi = current.uvi;
  if (uvi <= 2) uvIndex.classList.add('uv-low');
  else if (uvi <= 5) uvIndex.classList.add('uv-moderate');
  else if (uvi <= 7) uvIndex.classList.add('uv-high');
  else if (uvi <= 8) uvIndex.classList.add('uv-very-high');
  else uvIndex.classList.add('uv-extreme');

  setChildren(currentContainer, renderWeatherCard(headerEl, iconEl, bodyEl));
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
  if (data.error) {
    console.error(`"${searchString}" resulted in server response ${data.error.code}: ${data.error.description}`);
    return;
  }
  const out = {lat: data.latt, lon: data.longt};
  // reverse geolocating has a different output
  if (search.lat) out.name = data.city;
  else out.name = data.standard.city;
  return out;
}

async function fetchWeatherData(location) {
  if (!location) return;
  if (data.lastReq[location.name]) {
    // don't hit the API for the same location more than once every 15 minutes
    const lastReq = data.lastReq[location.name];
    const timeStamp = moment(lastReq.timeStamp);
    if (moment.duration(moment().diff(timeStamp)).asMinutes() <= 15)
      return renderWeatherData(lastReq.location.name, lastReq.weatherData);
  }
  const locationQuery = `lat=${location.lat}&lon=${location.lon}`;
  const weatherApiUrl = `https://api.openweathermap.org/data/2.5/onecall?${locationQuery}&appid=${data.apiKey}`;
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
  saveData();
  renderWeatherData(reqData.location.name, reqData.weatherData);
  renderPreviousSearches();
}

function formSubmitHandler(event) {
  event.preventDefault();
  const inputEl = event.target.querySelector('input[type=search]');
  const input = inputEl.value.trim().replace(/\s/g, ' ');
  inputEl.value = '';
  fetchGeolocation(input).then((location) => fetchWeatherData(location));
}
document.querySelector('#location').addEventListener('submit', formSubmitHandler);

let lastLocationBtnClick;
let locationBtnClickDebounce = false;
function locationBtnClickListener() {
  if (!lastLocationBtnClick) {
    lastLocationBtnClick = moment();
  } else if (locationBtnClickDebounce) {
    return;
  } else {
    // rate limit location button clicks to once every 5 seconds at most
    const timeDelta = moment.duration(moment().diff(lastLocationBtnClick)).asSeconds;
    if (timeDelta < 5 && !locationBtnClickDebounce) {
      setTimeout(locationBtnClickListener, 1000 * (5 - timeDelta));
      locationBtnClickDebounce = true;
      return;
    }
  }
  lastLocationBtnClick = moment();
  locationBtnClickDebounce = false;
  navigator.geolocation.getCurrentPosition(({coords}) => {
    fetchGeolocation({lat: coords.latitude, lon: coords.longitude}).then((location) => fetchWeatherData(location));
  });
}

function showApiKeyForm() {
  let prompt;
  if (!data.apiKey) {
    prompt = 'No API key found in LocalStorage, enter an API key to continue.';
    apiFormCancel.classList.add('hide');
  } else {
    prompt = `Current API Key is "${data.apiKey}" -- enter new API key below to change.`;
    apiFormCancel.classList.remove('hide');
  }
  apiKeyPrompt.textContent = prompt;
  apiKeyContainer.classList.remove('hide');
}

apiKeyForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = event.target.querySelector('#api-key-form input').value.trim();
  if (input) {
    data.apiKey = input;
    saveData();
    apiKeyContainer.classList.add('hide');
  }
});
apiKeyBtn.addEventListener('click', () => {
  showApiKeyForm();
});
apiFormCancel.addEventListener('click', () => {
  apiKeyContainer.classList.add('hide');
});
if (!data.apiKey) showApiKeyForm();

if (navigator.geolocation) {
  const getLocationBtn = document.querySelector('#get-location');
  getLocationBtn.classList.remove('hide');
  getLocationBtn.addEventListener('click', locationBtnClickListener);
}
if (data.previousSearches.length > 0) {
  previousSeachesContainer.classList.remove('hide');
  renderPreviousSearches();
  previousSeachesContainer.addEventListener('click', (event) => {
    if (data.lastReq[event.target.textContent]) fetchWeatherData(data.lastReq[event.target.textContent].location);
  });
}
