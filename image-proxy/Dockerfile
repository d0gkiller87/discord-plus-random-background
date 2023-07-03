FROM tiangolo/uvicorn-gunicorn-fastapi:latest
# COPY ./main.py /app/app/main.py
COPY ./requirements.txt /app/app/requirements.txt
RUN pip install -r /app/app/requirements.txt
EXPOSE 80
