FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV SCHEDULER=1
EXPOSE 8000
CMD ["python", "-m", "crunchradar", "serve", "--port", "8000"]
