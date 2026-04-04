FROM public.ecr.aws/lambda/python:3.12

# Install build tools for eccodes C library compilation
RUN dnf install -y gcc gcc-c++ cmake make wget && dnf clean all

# Install Python dependencies (eccodes Python package bundles the C library)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy handler
COPY handler.py .

CMD ["handler.handler"]
