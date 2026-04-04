FROM public.ecr.aws/lambda/python:3.12

RUN dnf install -y gcc gcc-c++ cmake make wget && dnf clean all

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY handler.py .

CMD ["handler.handler"]
