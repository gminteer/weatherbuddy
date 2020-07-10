import { el, mount, setChildren } from 'https://redom.js.org/redom.es.min.js';

const API_KEY = '***REMOVED***'; // having this exposed is a Bad Idea®
const data = JSON.parse(localStorage.getItem('weatherBuddyData')) || { lastReq: {}, previousSearches: [] };

// The API supports metric or imperial units, but the user gets to choose metric or imperial so might as well just
// accept their default units (kelvin and meters/sec)
const kelvinToFahrenheit = (tempK) => ((tempK - 273.15) * 9) / 5 + 32;
const kelvinToCelsius = (tempK) => tempK - 273.15;
const metricSpeedToMph = (metric) => metric * 2.237;

const currentContainer = document.querySelector('#current-weather-container');
const fiveDayContainer = document.querySelector('#five-day-container');
const previousSeachesContainer = document.querySelector('#previous-searches-container');

function renderFiveDay(fiveDay) {
  setChildren(fiveDayContainer, null);
  for (let i = 0; i < fiveDay.list.length; i += 8) {
    const weather = fiveDay.list[i];
    // skipping by 8 because we get forecasts for every 3 hours
    const column = el('.col.s4');
    const dayCard = el('.card.z-index-2');
    const titleEl = el('div.card-title.center', moment.unix(weather.dt).format('MM[/]DD'));
    const cardBody = el('.card-content.center');
    const cardBodyIcon = el(`i.wi.wi-owm-${weather.weather[0].id}.med-icon`);
    const weatherDetails = el('ul.collection');
    const condition = el('li.collection-item', `${weather.weather[0].main}`);
    const temperature = el('li.collection-item', `${kelvinToFahrenheit(weather.main.temp).toFixed(2)}°F`);
    const humidity = el('li.collection-item', `Humidity: ${weather.main.humidity}%`);
    setChildren(weatherDetails, [condition, temperature, humidity]);
    setChildren(cardBody, [cardBodyIcon, weatherDetails]);
    setChildren(dayCard, [titleEl, cardBody]);
    setChildren(column, dayCard);
    mount(fiveDayContainer, column);
  }
}

function renderWeatherData(current, fiveDay) {
  debugger;
  const titleEl = el(
    'div.card-title.center',
    `${current.name} - ${moment.unix(current.dt).format('MMM DD, YYYY hh:mma')}`
  );
  const cardBody = el('.card-content.center');
  const cardBodyIcon = el(`i.wi.wi-owm-${current.weather[0].id}.big-icon`);
  const weatherDetails = el('ul.collection');
  let currentCondition;
  if (current.weather.length > 1) {
    currentCondition = el('li.collection-item', `${current.weather[0].main} then ${current.weather[1].main}`);
  } else {
    currentCondition = el('li.collection-item', `${current.weather[0].main}`);
  }
  const temperature = el(
    'li.collection-item',
    `Temperature: ${kelvinToFahrenheit(current.main.temp).toFixed(2)}°F (feels like ${kelvinToFahrenheit(
      current.main.feels_like
    ).toFixed(2)})`
  );
  const humidity = el('li.collection-item', `Humidity: ${current.main.humidity}%`);
  const wind = el('li.collection-item', [
    `Wind Speed: ${metricSpeedToMph(current.wind.speed).toFixed(2)} MPH    `,
    el(`i.wi.wi-wind.from-${current.wind.deg}`, { style: { 'font-size': '1.5rem' } }),
  ]);
  const uvIndex = el('li.collection-item', el('span'));
  setChildren(weatherDetails, [currentCondition, temperature, humidity, wind]);
  setChildren(cardBody, [cardBodyIcon, weatherDetails]);

  setChildren(currentContainer, [titleEl, cardBody]);
  renderFiveDay(fiveDay);
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
  debugger;
  let searchString;
  if (search.lat) searchString = `${search.lat},${search.lon}`;
  else searchString = search;
  const geolocationApiUrl = `https://geocode.xyz/${searchString}?json=1`;
  const response = await fetch(geolocationApiUrl);
  if (!response.ok) {
    console.error(`"${searchString}" resulted in server response ${response.status}: ${response.statusText}`);
    return;
  }
  const data = await response.json();
  const out = { lat: data.latt, lon: data.longt };
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
    if (moment.duration(moment().diff(timeStamp)).minutes() <= 15) {
      return renderWeatherData(lastReq.weatherData);
    }
  }
  const locationQuery = `lat=${location.lat}&lon=${location.lon}`;
  const weatherApiUrl = `https://api.openweathermap.org/data/2.5/onecall?${locationQuery}&appid=${API_KEY}`;
  const reqData = {
    timeStamp: moment(),
  };
  let response = await fetch(weatherApiUrl);
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
  renderWeatherData(reqData.weatherData);
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
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      fetchGeolocation({ lat: coords.latitude, lon: coords.longitude }).then((location) => fetchWeatherData(location));
    });
  });
}
if (data.previousSearches.length > 0) {
  previousSeachesContainer.classList.remove('hide');
  renderPreviousSearches();
  previousSeachesContainer.addEventListener('click', (event) => {
    fetchWeatherData(data.lastReq[event.target.textContent].location);
  });
}
