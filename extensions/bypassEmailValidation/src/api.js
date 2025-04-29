import Joi from 'joi';

export default {
  id: 'bypassEmailValidation',
  handler: (config, {data}) => {
    const {error} = Joi.string().email().required().validate(data['$trigger'].payload.email);
    if(error){
      data['$trigger'].payload.email = data['$trigger'].payload.email + '.com';
    }
    return data['$trigger'].payload;
  }
};
