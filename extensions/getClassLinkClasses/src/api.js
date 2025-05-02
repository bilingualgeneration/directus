import axios from 'axios';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';

// Configuration - replace these with your actual credentials
const config = {
  consumerKey: 'b3bea92dcde7a56242faa026',
  consumerSecret: 'a79501d659823bf9d42db799',
  apiUrl: 'https://classlinkcertification3-vn-v2.rosterserver.com/ims/oneroster/v1p1'
};

// Initialize OAuth 1.0a client
const oauth = OAuth({
  consumer: {
    key: config.consumerKey,
    secret: config.consumerSecret
  },
  signature_method: 'HMAC-SHA1',
  hash_function(base_string, key) {
    return crypto.createHmac('sha1', key).update(base_string).digest('base64');
  }
});

// Function to make authenticated request
async function makeOAuthRequest(endpoint, method = 'GET') {
  try {
    // OAuth request data
    const request_data = {
      url: `${config.apiUrl}${endpoint}`,
      method: method
    };

    // Get OAuth headers
    const token = {
      key: config.token,
      secret: config.tokenSecret
    };
    
    const headers = oauth.toHeader(oauth.authorize(request_data, token));
    
    // Add Accept header for JSON response
    headers['Accept'] = 'application/json';

    // Make the request
    const response = await axios({
      url: request_data.url,
      method: request_data.method,
      headers: headers
    });

    return response.data;
  } catch (error) {
    console.error('Error making OAuth request:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

export default {
  id: 'getClassLinkClasses',
  handler: async (config, {data, getSchema, services}) => {
    const usersService = new services.UsersService({
      schema: await getSchema(),
      accountability: data['$accountability']
    });
    const user = await usersService.readByQuery({
      fields: ['*'],
      filter: {id: {_eq: data['$accountability'].user}}
    });
    const classes = await makeOAuthRequest(`/teachers/${user[0].external_identifier}/classes`);
    return classes;
  },
};
