from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from PIL import Image
import advocate
import io
import os

import urllib3
urllib3.disable_warnings( urllib3.exceptions.InsecureRequestWarning )

app = FastAPI()

@app.get( '/ ')
async def default():
  return { 'message': 'ok' }

@app.get( '/{token}' )
async def resize_and_compress( token: str, url: str, size: str, quality: int = 100 ):
  if not os.environ.get( 'token' ) or token != os.environ.get( 'token' ):
    return HTTPException( status_code = 401, detail = 'Invalid token.' )

  # Parse the image size
  size_parts = size.split( 'x' )

  # Check if width and height are provided
  if len( size_parts ) < 2:
    return HTTPException( status_code = 400, detail = 'Invalid image size format. Format: 1920x1080.' )

  # Check if width and height are both number
  try:
    canvas_width, canvas_height = int( size_parts[0] ), int( size_parts[1] )
  except Exception:
    return HTTPException( status_code = 400, detail = 'Invalid image size format. Format: 1920x1080.' )

  # Check if compression level is between 1~100
  if quality < 1 or quality > 100:
    return HTTPException( status_code = 400, detail = 'Invalid compression level. Must be between 1 and 100.' )

  # Fetch the image from the provided URL
  try:
    response = advocate.get(
      url,
      headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      },
      verify = False
    )
    image_data = response.content

    # Open the image using PIL
    image = Image.open( io.BytesIO( image_data ) )

    if canvas_width / image.width > canvas_height / image.height:
      resized_width = canvas_width
      resized_height = int( image.height * ( canvas_width / image.width ) )
    else:
      resized_height = canvas_height
      resized_width = int( image.width * ( canvas_height / image.height ) )

    # Resize and stretch the image to the specified size
    image = image.resize(( resized_width, resized_height ))

    # Crop the image to match the target size
    left = ( resized_width - canvas_width ) / 2
    top = ( resized_height - canvas_height ) / 2
    right = ( resized_width + canvas_width ) / 2
    bottom = ( resized_height + canvas_height ) / 2
    image = image.crop(( left, top, right, bottom ))

    # Save the result image to a byte stream as lossless WebP
    result_stream = io.BytesIO()
    image.save( result_stream, format = 'WebP', lossless = True )
    image.close()
    result_stream.seek( 0 )

    # Return the result image to the client
    return StreamingResponse( result_stream, media_type = 'image/webp' )
  except Exception as e:
    return HTTPException( status_code = 500, detail = 'Failed to fetch or process image.' )

if __name__ == '__main__':
  import uvicorn
  uvicorn.run( app, host = '0.0.0.0', port = 80 )
